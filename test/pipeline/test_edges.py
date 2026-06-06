"""
Tests for arivu.pipeline.edges — conditional routing logic.
"""
import pytest
from arivu.pipeline.edges import (
    route_after_sql_generator,
    route_after_query_verifier,
    route_after_admin_approval,
    route_after_db_execution,
    route_after_result_embedder,
    route_after_retrieval_agent,
    route_after_result_verifier,
    route_after_response_generator,
)
from arivu.pipeline.state import GraphState


def make_state(**kwargs):
    """Helper to create a GraphState with specific fields."""
    state = GraphState()
    for key, value in kwargs.items():
        setattr(state, key, value)
    return state


class TestRouteAfterSqlGenerator:
    def test_no_error_goes_to_verifier(self):
        state = make_state(sql="SELECT 1", error=None)
        assert route_after_sql_generator(state) == "query_verifier"

    def test_error_goes_to_boundary(self):
        state = make_state(error="LLM failed", error_node="sql_generator")
        assert route_after_sql_generator(state) == "error_boundary"


class TestRouteAfterQueryVerifier:
    def test_clean_goes_to_db_execution(self):
        state = make_state(verifier_error="", requires_approval=False)
        assert route_after_query_verifier(state) == "db_execution"

    def test_destructive_goes_to_admin_approval(self):
        state = make_state(verifier_error="", requires_approval=True)
        assert route_after_query_verifier(state) == "admin_approval"

    def test_error_with_retries_goes_back_to_generator(self):
        state = make_state(verifier_error="bad SQL", retry_count=0, max_retries=3)
        assert route_after_query_verifier(state) == "sql_generator"

    def test_error_max_retries_goes_to_boundary(self):
        state = make_state(verifier_error="bad SQL", retry_count=3, max_retries=3)
        assert route_after_query_verifier(state) == "error_boundary"


class TestRouteAfterAdminApproval:
    def test_approved_goes_to_db_execution(self):
        state = make_state(approved=True)
        assert route_after_admin_approval(state) == "db_execution"

    def test_rejected_goes_to_boundary(self):
        state = make_state(approved=False)
        assert route_after_admin_approval(state) == "error_boundary"

    def test_pending_goes_to_pending_end(self):
        state = make_state(approved=None)
        assert route_after_admin_approval(state) == "pending_end"


class TestRouteAfterDbExecution:
    def test_empty_result_goes_to_response_generator(self):
        state = make_state(raw_result=[], error=None, verifier_error="")
        assert route_after_db_execution(state) == "response_generator"

    def test_small_result_bypasses_embedder(self):
        state = make_state(raw_result=[{"id": 1}], error=None, verifier_error="")
        assert route_after_db_execution(state) == "response_generator"

    def test_large_result_goes_to_embedder(self):
        state = make_state(
            raw_result=[{"id": i} for i in range(201)],
            error=None,
            verifier_error="",
        )
        assert route_after_db_execution(state) == "result_embedder"

    def test_error_goes_to_boundary(self):
        state = make_state(raw_result=[], error="DB error", verifier_error="")
        assert route_after_db_execution(state) == "error_boundary"

    def test_verifier_error_retries(self):
        state = make_state(
            raw_result=[],
            error=None,
            verifier_error="retriable error",
            retry_count=0,
            max_retries=3,
        )
        assert route_after_db_execution(state) == "sql_generator"

    def test_verifier_error_max_retries(self):
        state = make_state(
            raw_result=[],
            error=None,
            verifier_error="retriable error",
            retry_count=3,
            max_retries=3,
        )
        assert route_after_db_execution(state) == "error_boundary"


class TestRouteAfterResultEmbedder:
    def test_no_error_goes_to_retrieval(self):
        state = make_state(error=None)
        assert route_after_result_embedder(state) == "retrieval_agent"

    def test_error_goes_to_boundary(self):
        state = make_state(error="embed failed")
        assert route_after_result_embedder(state) == "error_boundary"


class TestRouteAfterRetrievalAgent:
    def test_no_error_goes_to_result_verifier(self):
        state = make_state(error=None)
        assert route_after_retrieval_agent(state) == "result_verifier"

    def test_error_goes_to_boundary(self):
        state = make_state(error="retrieval failed")
        assert route_after_retrieval_agent(state) == "error_boundary"


class TestRouteAfterResultVerifier:
    def test_pass_goes_to_response_generator(self):
        state = make_state(result_verifier_error="")
        assert route_after_result_verifier(state) == "response_generator"

    def test_error_with_retries_goes_back_to_retrieval(self):
        state = make_state(result_verifier_error="bad", result_retry_count=0, max_result_retries=2)
        assert route_after_result_verifier(state) == "retrieval_agent"

    def test_error_max_retries_goes_to_response_generator(self):
        state = make_state(result_verifier_error="bad", result_retry_count=2, max_result_retries=2)
        assert route_after_result_verifier(state) == "response_generator"


class TestRouteAfterResponseGenerator:
    def test_no_error_goes_to_memory_write(self):
        state = make_state(error=None, response="Here are the results.")
        assert route_after_response_generator(state) == "memory_write"

    def test_error_goes_to_boundary(self):
        state = make_state(error="response gen failed")
        assert route_after_response_generator(state) == "error_boundary"
