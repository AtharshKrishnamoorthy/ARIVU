"""
Tests for arivu SDK — top-level imports and public API.
"""
import pytest


class TestTopLevelImports:
    """Verify that the documented public API is importable."""

    def test_import_arivu(self):
        from arivu import Arivu
        assert Arivu is not None

    def test_import_exceptions(self):
        from arivu import ArivuError, AuthError, ConnectionError
        from arivu import SchemaExtractionError, ModeViolationError
        assert ArivuError is not None
        assert AuthError is not None
        assert ConnectionError is not None
        assert SchemaExtractionError is not None
        assert ModeViolationError is not None

    def test_import_pipeline(self):
        from arivu import PipelineConfig, PipelineResult
        from arivu import run_pipeline, run_pipeline_async
        assert PipelineConfig is not None
        assert PipelineResult is not None
        assert run_pipeline is not None
        assert run_pipeline_async is not None


class TestExceptionHierarchy:
    def test_all_are_exceptions(self):
        from arivu import ArivuError, AuthError, ConnectionError
        from arivu import SchemaExtractionError, ModeViolationError
        assert issubclass(ArivuError, Exception)
        assert issubclass(AuthError, ArivuError)
        assert issubclass(ConnectionError, ArivuError)
        assert issubclass(SchemaExtractionError, ArivuError)
        assert issubclass(ModeViolationError, ArivuError)


class TestPipelineConfig:
    def test_defaults(self):
        from arivu import PipelineConfig
        cfg = PipelineConfig()
        assert cfg.max_query_chars == 10_000
        assert cfg.max_result_rows == 10_000
        assert cfg.max_retries == 3


class TestPipelineResult:
    def test_success_property(self):
        from arivu import PipelineResult
        ok = PipelineResult(response="hello", error=None)
        assert ok.success is True

        fail = PipelineResult(response="", error="bad")
        assert fail.success is False

    def test_pending_approval_property(self):
        from arivu import PipelineResult
        pending = PipelineResult(requires_approval=True, approved=None)
        assert pending.pending_approval is True

        approved = PipelineResult(requires_approval=True, approved=True)
        assert approved.pending_approval is False


class TestPackageLogging:
    def test_logging_configured(self):
        import logging
        root = logging.getLogger()
        assert len(root.handlers) > 0

    def test_arivu_logger_exists(self):
        import logging
        logger = logging.getLogger("arivu")
        assert logger is not None
