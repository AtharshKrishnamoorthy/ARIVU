"""
Tests for arivu.pipeline.state — GraphState dataclass and helpers.
"""
import pytest
from arivu.pipeline.state import GraphState


class TestGraphStateDefaults:
    def test_empty_state(self):
        state = GraphState()
        assert state.question == ""
        assert state.sql == ""
        assert state.response == ""
        assert state.error is None
        assert state.raw_result == []
        assert state.trace_events == []
        assert state.retry_count == 0
        assert state.max_retries == 3
        assert state.requires_approval is False
        assert state.approved is None
        assert state.rlhf_signal is None


class TestGraphStateHelpers:
    def test_has_error_false(self):
        state = GraphState()
        assert state.has_error() is False

    def test_has_error_true(self):
        state = GraphState()
        state.error = "something broke"
        assert state.has_error() is True

    def test_record_trace(self):
        state = GraphState()
        state.record_trace("sql_generator", "ok", 150.5, detail="generated SQL")
        assert len(state.trace_events) == 1
        event = state.trace_events[0]
        assert event["node"] == "sql_generator"
        assert event["status"] == "ok"
        assert event["latency_ms"] == 150.5
        assert event["detail"] == "generated SQL"

    def test_set_error(self):
        state = GraphState()
        exc = ValueError("bad query")
        state.set_error("sql_generator", exc)
        assert state.error == "bad query"
        assert state.error_node == "sql_generator"
        assert state.error_type == "ValueError"


class TestGraphStateFields:
    def test_all_fields_exist(self):
        state = GraphState()
        # Input fields
        assert hasattr(state, "original_question")
        assert hasattr(state, "question")
        assert hasattr(state, "schema_ctx")
        assert hasattr(state, "vector_store")
        assert hasattr(state, "session_id")
        assert hasattr(state, "mode")
        assert hasattr(state, "engine")
        assert hasattr(state, "dialect")
        assert hasattr(state, "connection_meta")
        assert hasattr(state, "interface")
        assert hasattr(state, "db_alias")
        # SQL generation
        assert hasattr(state, "sql")
        assert hasattr(state, "retry_count")
        assert hasattr(state, "max_retries")
        assert hasattr(state, "verifier_error")
        # DB execution
        assert hasattr(state, "raw_result")
        # RAG
        assert hasattr(state, "result_vector_store")
        assert hasattr(state, "retrieved_chunks")
        assert hasattr(state, "result_verifier_error")
        assert hasattr(state, "result_retry_count")
        assert hasattr(state, "max_result_retries")
        # Response
        assert hasattr(state, "response")
        # Error
        assert hasattr(state, "error")
        assert hasattr(state, "error_node")
        assert hasattr(state, "error_type")
        # Admin/RLHF
        assert hasattr(state, "requires_approval")
        assert hasattr(state, "approved")
        assert hasattr(state, "rlhf_signal")
        # Tracing
        assert hasattr(state, "trace_events")
