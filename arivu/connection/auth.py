"""
arivu.connection.auth
────────────────────────────
Credential validation, mode checking, and SQLAlchemy engine construction.

Kept deliberately thin — all it does is:
  1. Look up the dialect in the registry
  2. Build a connection URL via the dialect descriptor
  3. Fire a lightweight probe query to verify connectivity
  4. Raise a clean AuthError if anything goes wrong

Supported dialects (v0.2.0):
    postgresql   — PostgreSQL (psycopg2)
    mysql        — MySQL (PyMySQL)
    sqlite       — SQLite (built-in)
    snowflake    — Snowflake (snowflake-sqlalchemy)
    databricks   — Databricks Unity Catalog (databricks-sqlalchemy)
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, ArgumentError

from .exceptions import AuthError, DialectNotInstalledError

logger = logging.getLogger("arivu.auth")

ALLOWED_MODES = {"user", "admin"}

# What each mode is permitted to do — enforced in the pipeline layer
MODE_PERMISSIONS = {
    "user": {
        "allowed_statements": {"SELECT"},
        "description": "Read-only: SELECT queries only",
    },
    "admin": {
        "allowed_statements": {"SELECT", "INSERT", "UPDATE", "DELETE", "ALTER", "DROP", "CREATE", "TRUNCATE"},
        "description": "Full DDL + DML access with human-in-the-loop verification for destructive ops",
    },
}

DESTRUCTIVE_STATEMENTS = {"ALTER", "DROP", "TRUNCATE", "DELETE"}


# ─────────────────────────────────────────────────────────────────────────────
# Dialect Descriptor — base class
# ─────────────────────────────────────────────────────────────────────────────

class DialectDescriptor(ABC):
    """
    Base class for dialect descriptors. Each dialect knows how to:
      1. Build its own SQLAlchemy connection URL
      2. Provide the correct probe SQL
      3. Report which pip package is needed
    """
    name: str
    probe_sql: str = "SELECT 1"
    pip_install: str = ""

    @abstractmethod
    def build_url(self, **kwargs) -> str:
        """Build the SQLAlchemy connection URL from the provided parameters."""

    def build_engine(self, **kwargs) -> Any:
        """
        Build and return a SQLAlchemy engine.
        Override this for dialects that need custom create_engine kwargs.
        """
        url = self.build_url(**kwargs)
        return create_engine(
            url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            echo=False,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Built-in RDBMS dialects (always available — drivers are core deps)
# ─────────────────────────────────────────────────────────────────────────────

class PostgresDialect(DialectDescriptor):
    name = "postgresql"
    probe_sql = "SELECT 1"
    pip_install = "pip install psycopg2-binary"

    def build_url(self, host: str, port: int, user: str, password: str,
                  dbname: str, **kwargs) -> str:
        return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{dbname}"


class MySQLDialect(DialectDescriptor):
    name = "mysql"
    probe_sql = "SELECT 1"
    pip_install = "pip install pymysql"

    def build_url(self, host: str, port: int, user: str, password: str,
                  dbname: str, **kwargs) -> str:
        return f"mysql+pymysql://{user}:{password}@{host}:{port}/{dbname}"


class SQLiteDialect(DialectDescriptor):
    name = "sqlite"
    probe_sql = "SELECT 1"
    pip_install = ""  # built-in

    def build_url(self, dbname: str, **kwargs) -> str:
        return f"sqlite:///{dbname}"

    def build_engine(self, **kwargs) -> Any:
        url = self.build_url(**kwargs)
        return create_engine(url, echo=False)


# ─────────────────────────────────────────────────────────────────────────────
# Cloud warehouse dialects (optional — drivers installed separately)
# ─────────────────────────────────────────────────────────────────────────────

class SnowflakeDialect(DialectDescriptor):
    """
    Snowflake — cloud data warehouse.

    Required params: account, user, password, dbname
    Optional params: warehouse, role, schema_name
    Install: pip install arivu-ai[snowflake]
    """
    name = "snowflake"
    probe_sql = "SELECT CURRENT_VERSION()"
    pip_install = "pip install arivu-ai[snowflake]"

    def build_url(self, account: str, user: str, password: str, dbname: str,
                  warehouse: str = None, role: str = None,
                  schema_name: str = None, **kwargs) -> str:
        try:
            from snowflake.sqlalchemy import URL as SnowflakeURL
        except ImportError:
            raise DialectNotInstalledError("snowflake", self.pip_install)

        url_kwargs = {
            "user": user,
            "password": password,
            "account": account,
            "database": dbname,
        }
        if warehouse:
            url_kwargs["warehouse"] = warehouse
        if role:
            url_kwargs["role"] = role
        if schema_name:
            url_kwargs["schema"] = schema_name

        return str(SnowflakeURL(**url_kwargs))

    def build_engine(self, **kwargs) -> Any:
        url = self.build_url(**kwargs)
        return create_engine(
            url,
            pool_pre_ping=True,
            pool_size=3,
            max_overflow=5,
            echo=False,
        )


class DatabricksDialect(DialectDescriptor):
    """
    Databricks Unity Catalog — cloud lakehouse.

    Required params: host, http_path, access_token
    Optional params: catalog, schema_name
    Install: pip install arivu-ai[databricks]
    """
    name = "databricks"
    probe_sql = "SELECT 1"
    pip_install = "pip install arivu-ai[databricks]"

    def build_url(self, host: str, http_path: str, access_token: str,
                  catalog: str = "main", schema_name: str = "default",
                  **kwargs) -> str:
        try:
            import databricks.sqlalchemy  # noqa: F401
        except ImportError:
            raise DialectNotInstalledError("databricks", self.pip_install)

        return (
            f"databricks://token:{access_token}@{host}"
            f"?http_path={http_path}&catalog={catalog}&schema={schema_name}"
        )

    def build_engine(self, **kwargs) -> Any:
        url = self.build_url(**kwargs)
        return create_engine(
            url,
            echo=False,
            # Databricks has higher latency — adjust timeouts
            connect_args={"_socket_timeout": 60},
        )


# ─────────────────────────────────────────────────────────────────────────────
# Dialect Registry
# ─────────────────────────────────────────────────────────────────────────────

DIALECT_REGISTRY: dict[str, DialectDescriptor] = {
    desc.name: desc for desc in [
        PostgresDialect(),
        MySQLDialect(),
        SQLiteDialect(),
        SnowflakeDialect(),
        DatabricksDialect(),
    ]
}

# Backward-compatible alias for code that references the old dict
SUPPORTED_DIALECTS = {name: name for name in DIALECT_REGISTRY}


def get_dialect(name: str) -> DialectDescriptor:
    """Look up a dialect descriptor by name. Raises AuthError if unknown."""
    if name not in DIALECT_REGISTRY:
        raise AuthError(
            f"Unsupported dialect '{name}'. "
            f"Choose from: {', '.join(sorted(DIALECT_REGISTRY))}"
        )
    return DIALECT_REGISTRY[name]


def list_dialects() -> dict[str, dict]:
    """Return all registered dialects and whether their drivers are installed."""
    result = {}
    for name, desc in DIALECT_REGISTRY.items():
        installed = True
        if name == "snowflake":
            try:
                import snowflake.sqlalchemy  # noqa: F401
            except ImportError:
                installed = False
        elif name == "databricks":
            try:
                import databricks.sqlalchemy  # noqa: F401
            except ImportError:
                installed = False
        result[name] = {
            "installed": installed,
            "pip_install": desc.pip_install,
            "probe_sql": desc.probe_sql,
        }
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Public API — authenticate
# ─────────────────────────────────────────────────────────────────────────────

def authenticate(dialect: str = "postgresql", **kwargs) -> "sqlalchemy.engine.Engine":
    """
    Build a SQLAlchemy engine and verify the credentials with a probe query.

    Delegates URL building and engine creation to the dialect descriptor.
    Returns the live engine on success.
    Raises AuthError on any credential or connectivity failure.
    """
    desc = get_dialect(dialect)

    logger.debug(f"Building engine for dialect={dialect}")

    try:
        engine = desc.build_engine(**kwargs)
    except DialectNotInstalledError:
        raise  # re-raise as-is — don't wrap it
    except ArgumentError as exc:
        raise AuthError(f"Invalid connection parameters: {exc}") from exc

    # ── Probe query — fail fast with a clear message ──
    _probe(engine, desc.probe_sql)

    logger.info(f"Auth successful: dialect={dialect}")
    return engine


def validate_mode(mode: str) -> None:
    """
    Raise ValueError if the requested mode is not recognised.
    Called before any DB connection attempt.
    """
    if mode not in ALLOWED_MODES:
        raise ValueError(
            f"Invalid mode '{mode}'. "
            f"Choose from: {', '.join(sorted(ALLOWED_MODES))}"
        )


def is_destructive(sql: str) -> bool:
    """
    Return True if the SQL statement is destructive (requires admin + RLHF gate).
    Checks for destructive keywords anywhere in the SQL to prevent bypass via CTEs.
    """
    sql_upper = sql.strip().upper()
    for keyword in DESTRUCTIVE_STATEMENTS:
        if keyword in sql_upper:
            return True
    return False


def mode_permits(mode: str, sql: str) -> tuple[bool, str]:
    """
    Check whether the given mode permits execution of the SQL.
    Checks for disallowed keywords anywhere in the SQL to prevent bypass via CTEs.

    Returns (permitted: bool, reason: str).
    """
    sql_upper = sql.strip().upper()
    allowed = MODE_PERMISSIONS[mode]["allowed_statements"]

    for keyword in DESTRUCTIVE_STATEMENTS:
        if keyword in sql_upper and keyword not in allowed:
            return False, (
                f"Mode '{mode}' does not permit '{keyword}' statements. "
                f"Allowed: {', '.join(sorted(allowed))}"
            )

    cleaned_sql = sql_upper.lstrip("(\n\r\t ")
    first_keyword = cleaned_sql.split()[0] if cleaned_sql.split() else ""
    if first_keyword not in allowed:
        return False, (
            f"Mode '{mode}' does not permit '{first_keyword}' statements. "
            f"Allowed: {', '.join(sorted(allowed))}"
        )
    return True, "ok"


# ─────────────────────────────────────────────────────────────────────────────
# Internal
# ─────────────────────────────────────────────────────────────────────────────

def _probe(engine, probe_sql: str) -> None:
    """
    Run a minimal no-op query to verify the connection is live.
    Raises AuthError with a human-readable message on failure.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text(probe_sql))
    except OperationalError as exc:
        engine.dispose()
        _raise_auth_error(exc)
    except Exception as exc:
        engine.dispose()
        raise AuthError(f"Unexpected error during connection probe: {exc}") from exc


def _raise_auth_error(exc: OperationalError) -> None:
    """
    Parse the SQLAlchemy OperationalError and raise a clean AuthError.
    Strips the raw DSN from the message to avoid leaking credentials.
    """
    msg = str(exc.orig) if exc.orig else str(exc)

    if "password authentication failed" in msg.lower():
        raise AuthError("Authentication failed: incorrect username or password.") from exc
    elif "could not connect to server" in msg.lower() or "connection refused" in msg.lower():
        raise AuthError(
            "Could not reach the database server. "
            "Check that the host and port are correct and the server is running."
        ) from exc
    elif "database" in msg.lower() and "does not exist" in msg.lower():
        raise AuthError(
            f"Database not found. "
            "Check the dbname parameter."
        ) from exc
    else:
        raise AuthError(f"Connection failed: {msg}") from exc