"""
Tests for arivu.integrations.base — session mapping, pipeline routing, approval flow.
Uses a mock integration to test the base class logic.
"""
import pytest
from unittest.mock import MagicMock, patch
from arivu.integrations.base import BaseIntegration
from arivu.pipeline.runner import PipelineResult


class MockIntegration(BaseIntegration):
    """Concrete test implementation of BaseIntegration."""

    def start(self):
        self._running = True

    def stop(self):
        self._running = False

    def send_message(self, user_id, text):
        self.last_message = (user_id, text)

    def send_approval_request(self, user_id, sql, question, session_id):
        self.last_approval = (user_id, sql, question, session_id)


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.query.return_value = {
        "question": "test question",
        "schema_ctx": "CREATE TABLE t (id INT);",
        "vector_store": None,
        "session_id": "sess-1",
        "mode": "user",
        "engine": None,
        "dialect": "sqlite",
        "connection_meta": {},
        "interface": "test",
        "db_alias": "",
    }
    return db


@pytest.fixture
def integration(mock_db):
    return MockIntegration(mock_db)


class TestSessionMapping:
    def test_session_for_format(self, integration):
        session = integration._session_for("user123")
        assert session == "mockintegration:user123"

    def test_session_for_different_users(self, integration):
        s1 = integration._session_for("alice")
        s2 = integration._session_for("bob")
        assert s1 != s2
        assert "alice" in s1
        assert "bob" in s2


class TestHandleQuery:
    @patch("arivu.integrations.base.run_pipeline")
    def test_successful_query_sends_response(self, mock_run, integration, mock_db):
        mock_run.return_value = PipelineResult(
            response="Here are the results.",
            sql="SELECT 1",
        )
        integration.handle_query("user1", "show me data")
        assert integration.last_message[1] == "Here are the results."

    @patch("arivu.integrations.base.run_pipeline")
    def test_pending_approval_sends_approval_request(self, mock_run, integration, mock_db):
        mock_run.return_value = PipelineResult(
            response="Needs approval",
            sql="DROP TABLE temp",
            requires_approval=True,
            approved=None,
            session_id="sess-pending",
        )
        integration.handle_query("admin1", "drop temp table")
        assert integration.last_approval is not None
        assert integration.last_approval[1] == "DROP TABLE temp"
        assert integration.last_message[1] == (
            "⏳ This operation requires admin approval before it can run. "
            "Your request has been sent for review."
        )

    @patch("arivu.integrations.base.run_pipeline")
    def test_pipeline_input_includes_session(self, mock_run, integration, mock_db):
        mock_run.return_value = PipelineResult(response="ok")
        integration.handle_query("user1", "test")
        # Verify run_pipeline was called
        assert mock_run.called


class TestHandleApprove:
    @patch("arivu.integrations.base.get_pending_approval")
    def test_approve_no_pending(self, mock_pending, integration):
        mock_pending.return_value = None
        integration.handle_approve("admin1", "sess-nonexistent")
        assert "No pending" in integration.last_message[1]

    @patch("arivu.integrations.base.get_pending_approval")
    @patch("arivu.integrations.base.resolve_approval")
    def test_approve_success(self, mock_resolve, mock_pending, integration, mock_db):
        mock_pending.return_value = {
            "sql": "DROP TABLE temp",
            "question": "drop temp",
        }
        mock_db._engine = MagicMock()
        mock_conn = MagicMock()
        mock_db._engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db._engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        mock_result = MagicMock()
        mock_result.rowcount = 5
        mock_conn.execute.return_value = mock_result

        integration.handle_approve("admin1", "sess-approve")
        assert mock_resolve.called


class TestHandleReject:
    @patch("arivu.integrations.base.resolve_approval")
    def test_reject(self, mock_resolve, integration):
        integration.handle_reject("admin1", "sess-reject")
        assert mock_resolve.called
        assert "rejected" in integration.last_message[1].lower()


class TestFormatHelpers:
    def test_format_approval_message(self):
        msg = BaseIntegration.format_approval_message(
            sql="DROP TABLE temp",
            question="drop the temp table",
        )
        assert "DROP TABLE temp" in msg
        assert "drop the temp table" in msg
        assert "/approve" in msg

    def test_format_error_message(self):
        msg = BaseIntegration.format_error_message(
            error="SQL syntax error",
            session_id="sess-abc123",
        )
        assert "went wrong" in msg
        assert "sess-abc123"[:8] in msg


class TestRunPipelineOnly:
    @patch("arivu.integrations.base.run_pipeline")
    def test_returns_result(self, mock_run, integration, mock_db):
        mock_run.return_value = PipelineResult(response="ok")
        result = integration._run_pipeline_only("user1", "test query")
        assert isinstance(result, PipelineResult)
        assert result.success is True
