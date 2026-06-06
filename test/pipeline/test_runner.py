"""
Tests for arivu.pipeline.runner — PipelineConfig, PipelineResult, helpers.
Does NOT run the full graph (that needs LLM API keys).
"""
import pytest
from arivu.pipeline.runner import (
    PipelineConfig,
    PipelineResult,
    DEFAULT_CONFIG,
    _build_initial_state,
    _build_result,
)
from arivu.pipeline.state import GraphState


class TestPipelineConfig:
    def test_defaults(self):
        cfg = PipelineConfig()
        assert cfg.max_query_chars == 10_000
        assert cfg.max_result_rows == 10_000
        assert cfg.max_retries == 3

    def test_custom_values(self):
        cfg = PipelineConfig(max_query_chars=500, max_result_rows=100, max_retries=1)
        assert cfg.max_query_chars == 500
        assert cfg.max_result_rows == 100
        assert cfg.max_retries == 1

    def test_validate_query_pass(self):
        cfg = PipelineConfig(max_query_chars=100)
        ok, reason = cfg.validate_query("show me users")
        assert ok is True
        assert reason == ""

    def test_validate_query_fail(self):
        cfg = PipelineConfig(max_query_chars=10)
        ok, reason = cfg.validate_query("this is a very long query that exceeds the limit")
        assert ok is False
        assert "too long" in reason.lower()


class TestPipelineResult:
    def test_defaults(self):
        result = PipelineResult()
        assert result.response == ""
        assert result.sql == ""
        assert result.raw_result == []
        assert result.error is None
        assert result.success is True
        assert result.pending_approval is False

    def test_success_false(self):
        result = PipelineResult(error="something went wrong", error_node="sql_generator")
        assert result.success is False

    def test_pending_approval_true(self):
        result = PipelineResult(
            requires_approval=True,
            approved=None,
            session_id="sess-1",
        )
        assert result.pending_approval is True

    def test_pending_approval_false_when_approved(self):
        result = PipelineResult(requires_approval=True, approved=True)
        assert result.pending_approval is False

    def test_pending_approval_false_when_rejected(self):
        result = PipelineResult(requires_approval=True, approved=False)
        assert result.pending_approval is False

    def test_repr(self):
        result = PipelineResult(response="hello", sql="SELECT 1")
        r = repr(result)
        assert "PipelineResult" in r

    def test_results_truncated(self):
        result = PipelineResult(results_truncated=True)
        assert result.results_truncated is True


class TestBuildInitialState:
    def test_builds_graph_state(self):
        pipeline_input = {
            "question": "show users",
            "schema_ctx": "CREATE TABLE users (id INT);",
            "vector_store": None,
            "session_id": "sess-1",
            "mode": "user",
            "engine": None,
        }
        state = _build_initial_state(pipeline_input, None, PipelineConfig())
        assert isinstance(state, GraphState)
        assert state.question == "show users"
        assert state.session_id == "sess-1"
        assert state.mode == "user"

    def test_includes_optional_fields(self):
        pipeline_input = {
            "question": "test",
            "schema_ctx": "",
            "vector_store": None,
            "session_id": "s1",
            "mode": "admin",
            "engine": None,
            "dialect": "sqlite",
            "connection_meta": {"host": "localhost"},
            "interface": "telegram",
            "db_alias": "mydb",
        }
        state = _build_initial_state(pipeline_input, "positive", PipelineConfig())
        assert state.dialect == "sqlite"
        assert state.connection_meta == {"host": "localhost"}
        assert state.interface == "telegram"
        assert state.db_alias == "mydb"
        assert state.rlhf_signal == "positive"


class TestBuildResult:
    def test_builds_pipeline_result(self):
        final = {
            "response": "There are 5 users.",
            "sql": "SELECT COUNT(*) FROM users",
            "raw_result": [{"count": 5}],
            "error": None,
            "error_node": None,
            "requires_approval": False,
            "approved": None,
            "session_id": "sess-1",
            "trace_events": [],
        }
        result = _build_result(final, PipelineConfig())
        assert isinstance(result, PipelineResult)
        assert result.response == "There are 5 users."
        assert result.sql == "SELECT COUNT(*) FROM users"
        assert result.raw_result == [{"count": 5}]
        assert result.success is True

    def test_truncates_results(self):
        final = {
            "response": "many rows",
            "sql": "SELECT * FROM big_table",
            "raw_result": [{"id": i} for i in range(100)],
            "error": None,
            "session_id": "s1",
            "trace_events": [],
        }
        cfg = PipelineConfig(max_result_rows=10)
        result = _build_result(final, cfg)
        assert len(result.raw_result) == 10
        assert result.results_truncated is True

    def test_error_result(self):
        final = {
            "response": "An error occurred.",
            "sql": "",
            "raw_result": [],
            "error": "SQL syntax error",
            "error_node": "sql_generator",
            "session_id": "s1",
            "trace_events": [],
        }
        result = _build_result(final, PipelineConfig())
        assert result.success is False
        assert result.error == "SQL syntax error"


class TestIsRetriableDbError:
    def test_syntax_error_is_retriable(self):
        from arivu.pipeline.nodes import _is_retriable_db_error
        exc = Exception('syntax error at or near "UNION"')
        assert _is_retriable_db_error(exc) is True

    def test_no_such_table_is_retriable(self):
        from arivu.pipeline.nodes import _is_retriable_db_error
        exc = Exception("no such table: users")
        assert _is_retriable_db_error(exc) is True

    def test_relation_does_not_exist_is_retriable(self):
        from arivu.pipeline.nodes import _is_retriable_db_error
        exc = Exception('relation "users" does not exist')
        assert _is_retriable_db_error(exc) is True

    def test_non_retriable_error(self):
        from arivu.pipeline.nodes import _is_retriable_db_error
        exc = Exception("connection timeout")
        assert _is_retriable_db_error(exc) is False


class TestQueryVerifierNode:
    def test_parenthesized_select_is_allowed(self):
        from arivu.pipeline.nodes import query_verifier_node
        from arivu.pipeline.state import GraphState
        
        state = GraphState(sql="(\n  SELECT 1\n)")
        result = query_verifier_node(state)
        
        assert result.verifier_error == ""
        assert result.retry_count == 0

    def test_nested_parenthesized_select_is_allowed(self):
        from arivu.pipeline.nodes import query_verifier_node
        from arivu.pipeline.state import GraphState
        
        state = GraphState(sql="((SELECT 1))")
        result = query_verifier_node(state)
        
        assert result.verifier_error == ""
        assert result.retry_count == 0

    def test_invalid_sql_starts_rejected(self):
        from arivu.pipeline.nodes import query_verifier_node
        from arivu.pipeline.state import GraphState
        
        state = GraphState(sql="hello SELECT 1")
        result = query_verifier_node(state)
        
        assert result.verifier_error != ""
        assert result.retry_count == 1


