"""
Tests for arivu.connection.exceptions
"""
import pytest
from arivu.connection.exceptions import (
    ArivuError,
    AuthError,
    ConnectionError,
    SchemaExtractionError,
    DialectNotInstalledError,
    ModeViolationError,
)


class TestExceptionHierarchy:
    """Verify the exception inheritance chain."""

    def test_arivu_error_is_base(self):
        assert issubclass(AuthError, ArivuError)
        assert issubclass(ConnectionError, ArivuError)
        assert issubclass(SchemaExtractionError, ArivuError)
        assert issubclass(DialectNotInstalledError, ArivuError)
        assert issubclass(ModeViolationError, ArivuError)

    def test_arivu_error_can_be_caught_as_exception(self):
        with pytest.raises(Exception):
            raise ArivuError("test")


class TestArivuError:
    def test_basic_message(self):
        err = ArivuError("something went wrong")
        assert str(err) == "something went wrong"


class TestAuthError:
    def test_message(self):
        err = AuthError("bad password")
        assert str(err) == "bad password"


class TestConnectionError:
    def test_message(self):
        err = ConnectionError("connection lost")
        assert str(err) == "connection lost"


class TestSchemaExtractionError:
    def test_message(self):
        err = SchemaExtractionError("introspection failed")
        assert str(err) == "introspection failed"


class TestDialectNotInstalledError:
    def test_message_and_attributes(self):
        err = DialectNotInstalledError("snowflake", "pip install snowflake-sqlalchemy")
        assert err.dialect == "snowflake"
        assert err.pip_install == "pip install snowflake-sqlalchemy"
        assert "snowflake" in str(err)
        assert "pip install" in str(err)


class TestModeViolationError:
    def test_basic(self):
        err = ModeViolationError("user", "DROP")
        assert err.mode == "user"
        assert err.statement == "DROP"
        assert "user" in str(err)
        assert "DROP" in str(err)

    def test_with_reason(self):
        err = ModeViolationError("user", "DELETE", reason="not allowed")
        assert "not allowed" in str(err)
