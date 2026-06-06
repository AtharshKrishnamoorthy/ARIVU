"""
Tests for arivu.connection.auth — dialect registry, mode validation,
SQL permission checking, and URL building.
"""
import pytest
from arivu.connection.auth import (
    DialectDescriptor,
    PostgresDialect,
    MySQLDialect,
    SQLiteDialect,
    SnowflakeDialect,
    DatabricksDialect,
    DIALECT_REGISTRY,
    SUPPORTED_DIALECTS,
    MODE_PERMISSIONS,
    DESTRUCTIVE_STATEMENTS,
    get_dialect,
    list_dialects,
    validate_mode,
    is_destructive,
    mode_permits,
)
from arivu.connection.exceptions import AuthError, DialectNotInstalledError


class TestDialectRegistry:
    def test_all_dialects_registered(self):
        assert "postgresql" in DIALECT_REGISTRY
        assert "mysql" in DIALECT_REGISTRY
        assert "sqlite" in DIALECT_REGISTRY
        assert "snowflake" in DIALECT_REGISTRY
        assert "databricks" in DIALECT_REGISTRY

    def test_supported_dialects_alias(self):
        for name in DIALECT_REGISTRY:
            assert name in SUPPORTED_DIALECTS

    def test_get_dialect_returns_descriptor(self):
        desc = get_dialect("postgresql")
        assert isinstance(desc, DialectDescriptor)
        assert desc.name == "postgresql"

    def test_get_dialect_unknown_raises(self):
        with pytest.raises(AuthError, match="Unsupported dialect"):
            get_dialect("oracle")


class TestDialectDescriptors:
    def test_postgres_url(self):
        desc = PostgresDialect()
        url = desc.build_url(host="localhost", port=5432, user="u", password="p", dbname="db")
        assert "postgresql+psycopg2" in url
        assert "localhost" in url
        assert "5432" in url

    def test_mysql_url(self):
        desc = MySQLDialect()
        url = desc.build_url(host="localhost", port=3306, user="u", password="p", dbname="db")
        assert "mysql+pymysql" in url

    def test_sqlite_url(self):
        desc = SQLiteDialect()
        url = desc.build_url(dbname="test.db")
        assert "sqlite:///" in url
        assert "test.db" in url

    def test_sqlite_pip_install_empty(self):
        assert SQLiteDialect().pip_install == ""


class TestModeValidation:
    def test_valid_modes(self):
        validate_mode("user")
        validate_mode("admin")

    def test_invalid_mode_raises(self):
        with pytest.raises(ValueError, match="Invalid mode"):
            validate_mode("readonly")
        with pytest.raises(ValueError, match="Invalid mode"):
            validate_mode("superuser")


class TestModePermissions:
    def test_user_allowed_select(self):
        permitted, reason = mode_permits("user", "SELECT * FROM users")
        assert permitted is True

    def test_user_blocked_drop(self):
        permitted, reason = mode_permits("user", "DROP TABLE users")
        assert permitted is False
        assert "user" in reason
        assert "DROP" in reason

    def test_user_blocked_delete(self):
        permitted, reason = mode_permits("user", "DELETE FROM users")
        assert permitted is False

    def test_admin_allows_drop(self):
        permitted, reason = mode_permits("admin", "DROP TABLE users")
        assert permitted is True

    def test_admin_allows_insert(self):
        permitted, reason = mode_permits("admin", "INSERT INTO users VALUES (1)")
        assert permitted is True

    def test_user_blocked_update(self):
        permitted, reason = mode_permits("user", "UPDATE users SET name='x'")
        assert permitted is False

    def test_user_blocked_alter(self):
        permitted, reason = mode_permits("user", "ALTER TABLE users ADD COLUMN x INT")
        assert permitted is False

    def test_user_blocked_truncate(self):
        permitted, reason = mode_permits("user", "TRUNCATE TABLE users")
        assert permitted is False


class TestIsDestructive:
    def test_drop_is_destructive(self):
        assert is_destructive("DROP TABLE users") is True

    def test_delete_is_destructive(self):
        assert is_destructive("DELETE FROM users") is True

    def test_alter_is_destructive(self):
        assert is_destructive("ALTER TABLE users ADD COLUMN x INT") is True

    def test_truncate_is_destructive(self):
        assert is_destructive("TRUNCATE TABLE orders") is True

    def test_select_not_destructive(self):
        assert is_destructive("SELECT * FROM users") is False

    def test_insert_not_destructive(self):
        assert is_destructive("INSERT INTO users VALUES (1)") is False

    def test_update_not_destructive(self):
        assert is_destructive("UPDATE users SET name='x'") is False

    def test_destructive_in_cte(self):
        assert is_destructive("WITH x AS (SELECT 1) DROP TABLE y") is True


class TestListDialects:
    def test_returns_dict(self):
        result = list_dialects()
        assert isinstance(result, dict)
        assert "postgresql" in result
        assert "sqlite" in result

    def test_each_has_installed_flag(self):
        result = list_dialects()
        for name, info in result.items():
            assert "installed" in info
            assert "pip_install" in info
            assert "probe_sql" in info
