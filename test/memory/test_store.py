"""
Tests for arivu.memory.store — public API layer.
"""
import pytest
import os
from arivu.memory import store as memory_store


@pytest.fixture(autouse=True)
def reset_backend(tmp_memory_db):
    """Reset the singleton backend before each test."""
    os.environ["ARIVU_MEMORY_BACKEND"] = "sqlite"
    os.environ["ARIVU_SQLITE_PATH"] = tmp_memory_db
    memory_store._backend = None
    yield
    memory_store._backend = None


class TestSessionHistory:
    def test_save_and_load(self):
        memory_store.save_interaction(
            session_id="test-sess",
            question="how many users?",
            sql="SELECT COUNT(*) FROM users",
            response="42 users",
            trace_events=[],
        )
        history = memory_store.load_session_history("test-sess")
        assert len(history) == 1
        assert history[0]["question"] == "how many users?"


class TestPendingApproval:
    def test_save_get_resolve(self):
        memory_store.save_pending_approval(
            session_id="test-approve",
            sql="DROP TABLE temp",
            question="drop temp",
        )
        pending = memory_store.get_pending_approval("test-approve")
        assert pending is not None
        assert "DROP TABLE" in pending["sql"]

        memory_store.resolve_approval("test-approve", approved=True)
        assert memory_store.get_pending_approval("test-approve") is None


class TestRLHF:
    def test_save_and_get_log(self):
        memory_store.save_rlhf_signal(
            session_id="test-rlhf",
            question="test?",
            sql="SELECT 1",
            signal="positive",
        )
        log = memory_store.get_rlhf_log()
        assert any(e["signal"] == "positive" for e in log)


class TestErrorLog:
    def test_save_and_get(self):
        memory_store.save_error_event(
            session_id="test-err",
            error="test error",
            error_node="sql_generator",
            error_type="Error",
            question="test?",
            sql="SELECT",
            trace_events=[],
        )
        errors = memory_store.get_error_log()
        assert any("test error" in e["error"] for e in errors)


class TestTraces:
    def test_get_traces(self):
        memory_store.save_interaction(
            session_id="test-trace",
            question="test?",
            sql="SELECT 1",
            response="ok",
            trace_events=[{"node": "sql_generator", "status": "ok", "latency_ms": 100}],
        )
        traces = memory_store.get_pipeline_traces(session_id="test-trace")
        assert len(traces) >= 1


class TestSessionList:
    def test_get_sessions(self):
        memory_store.save_interaction(
            session_id="test-list",
            question="q",
            sql="s",
            response="r",
            trace_events=[],
        )
        sessions = memory_store.get_session_list()
        assert any(s["session_id"] == "test-list" for s in sessions)


class TestDashboardStats:
    def test_get_stats(self):
        stats = memory_store.get_dashboard_stats()
        assert isinstance(stats, dict)
        assert "total_sessions" in stats


class TestSavedQueries:
    def test_crud(self):
        memory_store.save_saved_query(
            query_id="test-q",
            session_id="test-sess",
            query="show users",
            sql="SELECT * FROM users",
        )
        result = memory_store.get_saved_query("test-q")
        assert result is not None

        memory_store.update_saved_query("test-q", notes="updated")
        updated = memory_store.get_saved_query("test-q")
        assert updated["notes"] == "updated"

        memory_store.delete_saved_query("test-q")
        assert memory_store.get_saved_query("test-q") is None


class TestConfigKV:
    def test_connections(self):
        memory_store.save_connections([{"alias": "mydb", "dialect": "sqlite"}])
        conns = memory_store.get_connections()
        assert len(conns) == 1
        assert conns[0]["alias"] == "mydb"

    def test_active_connection(self):
        memory_store.set_active_connection("mydb")
        active = memory_store.get_active_connection()
        assert active == "mydb"

    def test_llm_config(self):
        memory_store.save_llm_config({"provider": "groq", "model": "llama3"})
        config = memory_store.get_llm_config()
        assert config is not None
        assert config["provider"] == "groq"


class TestLLMStore:
    def test_save_list_activate(self):
        memory_store.save_llm_entry("entry-1", {
            "name": "My Groq",
            "provider": "groq",
            "model": "llama3",
        })
        entries = memory_store.list_llm_entries()
        assert any(e["id"] == "entry-1" for e in entries)

        memory_store.activate_llm_entry("entry-1")
        config = memory_store.get_llm_config()
        assert config is not None
        assert config["provider"] == "groq"

    def test_delete_entry(self):
        memory_store.save_llm_entry("entry-del", {
            "name": "To Delete",
            "provider": "openai",
            "model": "gpt-4",
        })
        # Verify it exists first
        entries_before = memory_store.list_llm_entries()
        assert any(e["id"] == "entry-del" for e in entries_before)

        memory_store.delete_llm_entry("entry-del")
        entries = memory_store.list_llm_entries()
        # delete_llm_entry sets the config to empty dict, not removes it
        # So check that the entry is empty or not present
        deleted = [e for e in entries if e["id"] == "entry-del"]
        if deleted:
            assert deleted[0].get("provider", "") == "" or deleted[0].get("name", "") == ""
