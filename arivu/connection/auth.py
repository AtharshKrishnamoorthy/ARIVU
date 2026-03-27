"""
arivu.connection.auth
────────────────────────────
Credential validation, mode checking, and SQLAlchemy engine construction.

Kept deliberately thin — all it does is:
  1. Build a connection URL from raw credentials
  2. Fire a lightweight probe query to verify connectivity
  3. Raise a clean AuthError if anything goes wrong
"""

from __future__ import annotations

import logging

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, ArgumentError

from .exceptions import AuthError

logger = logging.getLogger("arivu.auth")

SUPPORTED_DIALECTS = {
    "postgresql": "postgresql+psycopg2",
    "mysql": "mysql+pymysql",
    "sqlite": "sqlite",
}

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


def authenticate(
    host: str,
    port: int,
    user: str,
    password: str,
    dbname: str,
    dialect: str = "postgresql",
) -> "sqlalchemy.engine.Engine":
    """
    Build a SQLAlchemy engine and verify the credentials with a probe query.

    Returns the live engine on success.
    Raises AuthError on any credential or connectivity failure.
    """
    if dialect not in SUPPORTED_DIALECTS:
        raise AuthError(
            f"Unsupported dialect '{dialect}'. "
            f"Choose from: {', '.join(SUPPORTED_DIALECTS)}"
        )

    driver = SUPPORTED_DIALECTS[dialect]

    # SQLite is file-based — no host/port/user needed
    if dialect == "sqlite":
        url = f"sqlite:///{dbname}"
    else:
        url = f"{driver}://{user}:{password}@{host}:{port}/{dbname}"

    logger.debug(f"Building engine for {dialect}://{host}:{port}/{dbname}")

    try:
        engine = create_engine(
            url,
            pool_pre_ping=True,      # verifies connections before checkout
            pool_size=5,
            max_overflow=10,
            echo=False,
        )
    except ArgumentError as exc:
        raise AuthError(f"Invalid connection parameters: {exc}") from exc

    # ── Probe query — fail fast with a clear message ──
    _probe(engine, dialect)

    logger.info(f"Auth successful: {dialect}://{host}:{port}/{dbname} as user='{user}'")
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
    Used by the query verifier node in the pipeline.
    """
    first_keyword = sql.strip().upper().split()[0] if sql.strip() else ""
    return first_keyword in DESTRUCTIVE_STATEMENTS


def mode_permits(mode: str, sql: str) -> tuple[bool, str]:
    """
    Check whether the given mode permits execution of the SQL.

    Returns (permitted: bool, reason: str).
    """
    first_keyword = sql.strip().upper().split()[0] if sql.strip() else ""
    allowed = MODE_PERMISSIONS[mode]["allowed_statements"]

    if first_keyword not in allowed:
        return False, (
            f"Mode '{mode}' does not permit '{first_keyword}' statements. "
            f"Allowed: {', '.join(sorted(allowed))}"
        )
    return True, "ok"


# ─────────────────────────────────────────────────────────────────────────────
# Internal
# ─────────────────────────────────────────────────────────────────────────────

def _probe(engine, dialect: str) -> None:
    """
    Run a minimal no-op query to verify the connection is live.
    Raises AuthError with a human-readable message on failure.
    """
    probe_sql = {
        "postgresql": "SELECT 1",
        "mysql": "SELECT 1",
        "sqlite": "SELECT 1",
    }.get(dialect, "SELECT 1")

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