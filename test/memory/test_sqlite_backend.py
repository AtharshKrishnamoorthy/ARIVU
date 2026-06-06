"""
Tests for arivu.memory.sqlite_backend — full CRUD for all tables.
"""
import pytest
import os
import time
from arivu.memory.sqlite_backend import SQLiteMemoryBackend


@pytest.fixture
def backend(tmp_memory_db):
    return SQLiteMemoryBackend(db_path=tmp_memory_db)


class TestSessionHistory:
    def test_save_and_load(self, backend):
        backend.save_interaction(
            session_id="sess-1",
            question="how many users?",
            sql="SELECT COUNT(*) FROM users",
            response="There are 42 users.",
            trace_events=[],
        )
        history = backend.load_session_history("sess-1")
        assert len(history) == 1
        assert history[0]["question"] == "how many users?"
        assert history[0]["sql"] == "SELECT COUNT(*) FROM users"

    def test_load_limit(self, backend):
        for i in range(10):
            backend.save_interaction(
                session_id="sess-2",
                question=f"q{i}",
                sql=f"SELECT {i}",
                response=f"r{i}",
                trace_events=[],
            )
        history = backend.load_session_history("sess-2", limit=3)
        assert len(history) == 3

    def test_load_empty_session(self, backend):
        history = backend.load_session_history("nonexistent")
        assert history == []

    def test_multiple_sessions(self, backend):
        backend.save_interaction(
            session_id="sess-a", question="qa", sql="sa", response="ra", trace_events=[]
        )
        backend.save_interaction(
            session_id="sess-b", question="qb", sql="sb", response="rb", trace_events=[]
        )
        assert len(backend.load_session_history("sess-a")) == 1
        assert len(backend.load_session_history("sess-b")) == 1


class TestPendingApproval:
    def test_save_and_get(self, backend):
        backend.save_pending_approval(
            session_id="sess-approve",
            sql="DROP TABLE temp",
            question="drop the temp table",
        )
        pending = backend.get_pending_approval("sess-approve")
        assert pending is not None
        assert "DROP TABLE" in pending["sql"]

    def test_resolve_approved(self, backend):
        backend.save_pending_approval(
            session_id="sess-resolve",
            sql="DROP TABLE x",
            question="drop x",
        )
        backend.resolve_approval("sess-resolve", approved=True)
        assert backend.get_pending_approval("sess-resolve") is None

    def test_resolve_rejected(self, backend):
        backend.save_pending_approval(
            session_id="sess-reject",
            sql="DROP TABLE y",
            question="drop y",
        )
        backend.resolve_approval("sess-reject", approved=False)
        assert backend.get_pending_approval("sess-reject") is None

    def test_get_nonexistent(self, backend):
        assert backend.get_pending_approval("no-such-session") is None


class TestRLHFSignals:
    def test_save_positive(self, backend):
        backend.save_rlhf_signal(
            session_id="sess-rlhf",
            question="test?",
            sql="SELECT 1",
            signal="positive",
            approved=None,
        )
        log = backend.get_rlhf_log()
        assert len(log) >= 1
        assert any(e["signal"] == "positive" for e in log)

    def test_save_negative(self, backend):
        backend.save_rlhf_signal(
            session_id="sess-rlhf2",
            question="test?",
            sql="SELECT 1",
            signal="negative",
            approved=None,
        )
        log = backend.get_rlhf_log()
        assert any(e["signal"] == "negative" for e in log)

    def test_filter_by_signal(self, backend):
        backend.save_rlhf_signal(
            session_id="s1", question="q1", sql="s1", signal="positive", approved=None
        )
        backend.save_rlhf_signal(
            session_id="s2", question="q2", sql="s2", signal="negative", approved=None
        )
        pos = backend.get_rlhf_log(signal_filter="positive")
        neg = backend.get_rlhf_log(signal_filter="negative")
        assert all(e["signal"] == "positive" for e in pos)
        assert all(e["signal"] == "negative" for e in neg)

    def test_limit(self, backend):
        for i in range(20):
            backend.save_rlhf_signal(
                session_id=f"s{i}", question=f"q{i}", sql=f"s{i}", signal="positive", approved=None
            )
        log = backend.get_rlhf_log(limit=5)
        assert len(log) <= 5


class TestErrorEvents:
    def test_save_and_get(self, backend):
        backend.save_error_event(
            session_id="sess-err",
            error="SQL syntax error",
            error_node="sql_generator",
            error_type="SyntaxError",
            question="bad query",
            sql="SELEC * FROM",
            trace_events=[],
        )
        errors = backend.get_error_log()
        assert len(errors) >= 1
        assert any("SQL syntax error" in e["error"] for e in errors)

    def test_limit(self, backend):
        for i in range(15):
            backend.save_error_event(
                session_id=f"s{i}",
                error=f"error {i}",
                error_node="node",
                error_type="Error",
                question=f"q{i}",
                sql=f"s{i}",
                trace_events=[],
            )
        errors = backend.get_error_log(limit=5)
        assert len(errors) <= 5


class TestPipelineTraces:
    def test_save_via_interaction(self, backend):
        backend.save_interaction(
            session_id="sess-trace",
            question="test?",
            sql="SELECT 1",
            response="ok",
            trace_events=[
                {"node": "sql_generator", "status": "ok", "latency_ms": 100},
                {"node": "db_execution", "status": "ok", "latency_ms": 50},
            ],
        )
        traces = backend.get_pipeline_traces(session_id="sess-trace")
        assert len(traces) >= 1

    def get_all_traces(self, backend):
        traces = backend.get_pipeline_traces()
        assert isinstance(traces, list)


class TestSessionList:
    def test_returns_sessions(self, backend):
        backend.save_interaction(
            session_id="sess-list-1", question="q1", sql="s1", response="r1", trace_events=[]
        )
        backend.save_interaction(
            session_id="sess-list-2", question="q2", sql="s2", response="r2", trace_events=[]
        )
        sessions = backend.get_session_list()
        session_ids = [s["session_id"] for s in sessions]
        assert "sess-list-1" in session_ids
        assert "sess-list-2" in session_ids


class TestDashboardStats:
    def test_returns_dict(self, backend):
        stats = backend.get_dashboard_stats()
        assert isinstance(stats, dict)
        assert "total_sessions" in stats
        assert "total_queries" in stats
        assert "total_errors" in stats
        assert "error_rate" in stats


class TestConfigKV:
    def test_save_and_get(self, backend):
        backend.save_config("test_key", {"value": 42})
        result = backend.get_config("test_key")
        assert result == {"value": 42}

    def test_get_nonexistent(self, backend):
        assert backend.get_config("no_such_key") is None

    def test_get_by_prefix(self, backend):
        backend.save_config("llm:entry1", {"provider": "groq", "model": "llama3"})
        backend.save_config("llm:entry2", {"provider": "openai", "model": "gpt-4"})
        backend.save_config("other:key", {"x": 1})
        entries = backend.get_configs_by_prefix("llm:")
        assert len(entries) == 2
        assert "entry1" in entries
        assert "entry2" in entries


class TestSavedQueries:
    def test_crud(self, backend):
        backend.save_saved_query(
            query_id="q1",
            session_id="sess-1",
            query="show users",
            sql="SELECT * FROM users",
            notes="basic query",
        )
        result = backend.get_saved_query("q1")
        assert result is not None
        assert result["query"] == "show users"

        backend.update_saved_query("q1", notes="updated notes")
        updated = backend.get_saved_query("q1")
        assert updated["notes"] == "updated notes"

        backend.delete_saved_query("q1")
        assert backend.get_saved_query("q1") is None

    def test_list_queries(self, backend):
        for i in range(5):
            backend.save_saved_query(
                query_id=f"q{i}",
                session_id="sess-1",
                query=f"query {i}",
                sql=f"SELECT {i}",
            )
        queries = backend.list_saved_queries()
        assert len(queries) == 5

    def test_list_session_queries(self, backend):
        backend.save_saved_query(
            query_id="sq1", session_id="sess-x", query="qx", sql="sx"
        )
        backend.save_saved_query(
            query_id="sq2", session_id="sess-y", query="qy", sql="sy"
        )
        queries = backend.list_session_saved_queries("sess-x")
        assert len(queries) == 1
        assert queries[0]["query"] == "qx"
