"""
Tests for arivu.pipeline.progress — ProgressLogger.
"""
import pytest
from arivu.pipeline.progress import ProgressLogger


class TestProgressLoggerNoCallback:
    def test_log_no_crash(self, caplog):
        pl = ProgressLogger()
        pl.log("sql_generator", detail="completed")
        assert "sql_generator" in caplog.text

    def test_log_success(self, caplog):
        pl = ProgressLogger()
        pl.log_success("db_execution", "rows=5")
        assert "db_execution" in caplog.text

    def test_log_error(self, caplog):
        pl = ProgressLogger()
        pl.log_error("sql_generator", "syntax error")
        assert "sql_generator" in caplog.text

    def test_log_pending(self, caplog):
        pl = ProgressLogger()
        pl.log_pending("query_verifier", "waiting")
        assert "query_verifier" in caplog.text

    def test_log_start(self, caplog):
        pl = ProgressLogger()
        pl.log_start(session_id="sess-123", mode="user", question="show users")
        assert "PIPELINE START" in caplog.text

    def test_log_end(self, caplog):
        pl = ProgressLogger()
        pl.log_end(nodes_run=5, error="")
        assert "PIPELINE DONE" in caplog.text

    def test_log_crash(self, caplog):
        pl = ProgressLogger()
        pl.log_crash("ValueError: bad")
        assert "PIPELINE CRASHED" in caplog.text


class TestProgressLoggerWithCallback:
    def test_callback_called(self):
        messages = []
        pl = ProgressLogger(callback=lambda msg, **kw: messages.append(msg))
        pl.log("sql_generator", detail="done")
        assert len(messages) == 1
        assert "sql_generator" in messages[0]

    def test_callback_has_prefix(self):
        messages = []
        pl = ProgressLogger(callback=lambda msg, **kw: messages.append(msg))
        pl.log("test_node", detail="ok")
        assert "test_node" in messages[0]

    def test_callback_log_start(self):
        messages = []
        pl = ProgressLogger(callback=lambda msg, **kw: messages.append(msg))
        pl.log_start(session_id="sess-1", mode="user", question="test?")
        assert len(messages) == 4  # separator, header, detail, separator
        assert "PIPELINE START" in messages[1]

    def test_callback_log_end(self):
        messages = []
        pl = ProgressLogger(callback=lambda msg, **kw: messages.append(msg))
        pl.log_end(nodes_run=3, error="")
        assert len(messages) >= 1
        assert "PIPELINE DONE" in messages[0]

    def test_callback_log_crash(self):
        messages = []
        pl = ProgressLogger(callback=lambda msg, **kw: messages.append(msg))
        pl.log_crash("test error")
        assert len(messages) == 1
        assert "PIPELINE CRASHED" in messages[0]


class TestProgressLoggerActive:
    def test_set_and_get_active(self):
        pl = ProgressLogger()
        ProgressLogger.set_active(pl)
        assert ProgressLogger.get_active() is pl

    def test_get_active_creates_default(self):
        ProgressLogger._active = None
        active = ProgressLogger.get_active()
        assert active is not None
        assert isinstance(active, ProgressLogger)
