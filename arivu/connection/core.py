"""
arivu.connection.core
────────────────────────────
The single entry point for all DB interactions.

Usage (traditional RDBMS):
    db = Arivu.connect(
        host="localhost",
        port=5432,
        user="atharsh",
        password="secret",
        dbname="ecommerce",
        mode="user",
        dialect="postgresql",
    )

Usage (Snowflake):
    db = Arivu.connect(
        dialect="snowflake",
        account="xy12345.us-east-1",
        user="atharsh",
        password="secret",
        dbname="analytics",
        warehouse="COMPUTE_WH",
    )

Usage (Databricks):
    db = Arivu.connect(
        dialect="databricks",
        host="adb-123.azuredatabricks.net",
        http_path="/sql/1.0/endpoints/abc123",
        access_token="dapi...",
        catalog="main",
    )

    result = db.query("show me top 10 orders last month")
    db.refresh_schema()
    db.close()
"""

from __future__ import annotations

import time
import uuid
import logging
from typing import Optional

from sqlalchemy import text
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from .auth import authenticate, validate_mode, get_dialect
from .schema import extract_schema, serialize_to_sql_ctx
from .cache import SchemaCache
from .exceptions import (
    AuthError,
    ConnectionError as DHConnectionError,
    SchemaExtractionError,
    DialectNotInstalledError,
)

logger = logging.getLogger("arivu.connection")


class Arivu:
    """
    Verified, mode-aware DB connection with schema caching.

    Do not instantiate directly — always use Arivu.connect().
    """

    def __init__(
        self,
        engine,
        mode: str,
        session_id: str,
        schema_cache: SchemaCache,
        dialect: str,
        connection_display: str = "",
        query_timeout: int = 30,
    ) -> None:
        self._engine = engine
        self._mode = mode
        self._session_id = session_id
        self._schema_cache = schema_cache
        self._dialect = dialect
        self._connection_display = connection_display
        self._closed = False
        self._query_timeout = query_timeout

    # ─────────────────────────────────────────
    # Factory
    # ─────────────────────────────────────────

    @classmethod
    def connect(
        cls,
        dialect: str = "postgresql",
        # ── Traditional RDBMS params ──
        host: str = None,
        port: int = 5432,
        user: str = None,
        password: str = None,
        dbname: str = None,
        # ── Snowflake-specific ──
        account: str = None,
        warehouse: str = None,
        role: str = None,
        schema_name: str = None,
        # ── Databricks-specific ──
        http_path: str = None,
        access_token: str = None,
        catalog: str = None,
        # ── Common options ──
        mode: str = "user",
        ttl: int = 3600,
        schema_on_connect: bool = True,
        query_timeout: int = 30,
        **extra_kwargs,
    ) -> "Arivu":
        """
        Authenticate, verify mode, extract schema, and return a ready connection.

        Supports all registered dialects. Cloud warehouse params (account,
        warehouse, http_path, etc.) are forwarded to the dialect descriptor.

        Raises:
            AuthError                — bad credentials or unreachable host
            ConnectionError          — TCP / network failure
            SchemaExtractionError    — introspection failed after auth
            DialectNotInstalledError — missing driver package
            ValueError               — invalid mode
        """
        validate_mode(mode)

        # Resolve the dialect descriptor (validates it exists)
        desc = get_dialect(dialect)

        # Build the kwargs dict to pass to authenticate()
        connect_kwargs = {"dialect": dialect}

        if dialect in ("postgresql", "mysql"):
            connect_kwargs.update(
                host=host, port=port, user=user,
                password=password, dbname=dbname,
            )
            display = f"{dialect}://{host}:{port}/{dbname}"
        elif dialect == "sqlite":
            connect_kwargs.update(dbname=dbname)
            display = f"sqlite:///{dbname}"
        elif dialect == "snowflake":
            connect_kwargs.update(
                account=account, user=user, password=password,
                dbname=dbname, warehouse=warehouse, role=role,
                schema_name=schema_name,
            )
            display = f"snowflake://{account}/{dbname}"
        elif dialect == "databricks":
            connect_kwargs.update(
                host=host, http_path=http_path,
                access_token=access_token, catalog=catalog,
                schema_name=schema_name,
            )
            display = f"databricks://{host}"
        else:
            # Future dialects — pass everything through
            connect_kwargs.update(
                host=host, port=port, user=user, password=password,
                dbname=dbname, **extra_kwargs,
            )
            display = f"{dialect}://{host}:{port}/{dbname}"

        logger.info(f"Connecting  {display}  mode={mode}")

        # ── Step 1: auth + build engine ──────────────
        engine = authenticate(**connect_kwargs)

        # ── Step 2: session identity ──────────────────
        session_id = str(uuid.uuid4())

        # ── Step 3: schema extraction ─────────────────
        schema_cache = SchemaCache(ttl=ttl)

        if schema_on_connect:
            _run_schema_extraction(engine, schema_cache, dialect)

        instance = cls(
            engine=engine,
            mode=mode,
            session_id=session_id,
            schema_cache=schema_cache,
            dialect=dialect,
            connection_display=display,
            query_timeout=query_timeout,
        )

        logger.info(
            f"Connection ready  session_id={session_id}  mode={mode}  "
            f"schema_cached={'yes' if schema_cache.is_valid() else 'no'}"
        )
        logger.info(f"Connected  session={session_id[:12]}  schema={'cached' if schema_cache.is_valid() else 'empty'}")
        return instance

    # ─────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────

    def query(self, nl_question: str) -> dict:
        """
        Entry point for the agentic pipeline.
        Automatically refreshes schema if stale before handing off.

        Returns a dict handed to the LangGraph pipeline:
            {
                "question": str,
                "schema_ctx": str,
                "vector_store": FAISSVectorStore,
                "session_id": str,
                "mode": str,
                "engine": Engine,
            }
        """
        self._assert_open()
        self._auto_refresh_if_stale()

        return {
            "question": nl_question,
            "schema_ctx": self._schema_cache.sql_ctx,
            "vector_store": self._schema_cache.vector_store,
            "session_id": self._session_id,
            "mode": self._mode,
            "engine": self._engine,
            "dialect": self._dialect,
            "connection_meta": {
                "dialect": self._dialect,
                "display": self._connection_display,
                "mode": self._mode,
            },
        }

    def refresh_schema(self) -> None:
        """
        On-demand schema refresh — bypasses TTL and forces re-extraction.
        Call this after running migrations or DDL changes.
        """
        self._assert_open()
        logger.info(f"Manual schema refresh triggered  session_id={self._session_id}")
        _run_schema_extraction(self._engine, self._schema_cache, self._dialect)

    def close(self) -> None:
        """Dispose the SQLAlchemy engine and mark the connection closed."""
        if not self._closed:
            self._engine.dispose()
            self._closed = True
            logger.info(f"Connection closed  session_id={self._session_id}")

    def ping(self) -> bool:
        """
        Quick health check — returns True if the DB is reachable.

        Runs a lightweight probe query (SELECT 1) to verify connectivity.
        """
        self._assert_open()
        try:
            with self._engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True
        except Exception:
            return False

    def list_tables(self) -> list[str]:
        """
        Return a list of table names from the current schema cache.

        Triggers a schema refresh if the cache is empty or stale.
        """
        self._assert_open()
        self._auto_refresh_if_stale()
        raw = self._schema_cache.raw_schema or []
        return [t["table"] for t in raw]

    def execute_sql(self, sql: str, params: dict | None = None) -> list[dict]:
        """
        Execute raw SQL and return results as a list of dicts.

        WARNING: This bypasses the Arivu safety pipeline. Destructive
        operations will execute without approval. Use with caution.

        Args:
            sql: Raw SQL statement
            params: Optional parameter dict for parameterized queries

        Returns:
            List of row dicts for SELECT queries, empty list for others.
        """
        self._assert_open()
        with self._engine.connect() as conn:
            result = conn.execute(text(sql), params or {})
            if result.returns_rows:
                return [dict(row) for row in result]
            conn.commit()
            return []

    # ─────────────────────────────────────────
    # Properties
    # ─────────────────────────────────────────

    @property
    def mode(self) -> str:
        return self._mode

    @property
    def session_id(self) -> str:
        return self._session_id

    @property
    def schema_ctx(self) -> Optional[str]:
        return self._schema_cache.sql_ctx if self._schema_cache.is_valid() else None

    @property
    def schema_age_seconds(self) -> Optional[float]:
        """How old the current schema cache is in seconds."""
        return self._schema_cache.age_seconds

    @property
    def query_timeout(self) -> int:
        """Query timeout in seconds."""
        return self._query_timeout

    # ─────────────────────────────────────────
    # Context manager support
    # ─────────────────────────────────────────

    def __enter__(self) -> "Arivu":
        return self

    def __exit__(self, *_) -> None:
        self.close()

    def __repr__(self) -> str:
        return (
            f"<Arivu session={self._session_id[:8]}  "
            f"dialect={self._dialect}  "
            f"mode={self._mode}  "
            f"schema={'fresh' if self._schema_cache.is_valid() else 'stale/empty'}>"
        )

    # ─────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────

    def _assert_open(self) -> None:
        if self._closed:
            raise DHConnectionError(
                "This Arivu connection has been closed. "
                "Create a new one with Arivu.connect()."
            )

    def _auto_refresh_if_stale(self) -> None:
        if self._schema_cache.is_stale():
            logger.info(
                f"Schema TTL expired — auto-refreshing  "
                f"session_id={self._session_id}  "
                f"age={self._schema_cache.age_seconds:.0f}s"
            )
            _run_schema_extraction(self._engine, self._schema_cache, self._dialect)


# ─────────────────────────────────────────────────────────────────────────────
# Module-level helper (not part of the public API)
# ─────────────────────────────────────────────────────────────────────────────

def _run_schema_extraction(engine, schema_cache: SchemaCache, dialect: str) -> None:
    """Extract schema, serialise, embed, and populate the cache."""
    try:
        raw_schema = extract_schema(engine, dialect)
        sql_ctx = serialize_to_sql_ctx(raw_schema)
        schema_cache.populate(sql_ctx=sql_ctx, raw_schema=raw_schema)
        logger.info(
            f"Schema extracted  tables={len(raw_schema)}  "
            f"ctx_chars={len(sql_ctx)}"
        )
    except Exception as exc:
        raise SchemaExtractionError(
            f"Failed to extract schema: {exc}"
        ) from exc