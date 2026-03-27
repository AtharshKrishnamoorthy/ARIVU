"""
arivu.connection.core
────────────────────────────
The single entry point for all DB interactions.

Usage:
    db = Arivu.connect(
        host="localhost",
        port=5432,
        user="atharsh",
        password="secret",
        dbname="ecommerce",
        mode="user",          # "user" | "admin"
        ttl=3600,             # schema cache TTL in seconds (default 1h)
        dialect="postgresql", # "postgresql" | "mysql" | "sqlite"
    )

    result = db.query("show me top 10 orders last month")
    db.refresh_schema()  # on-demand schema refresh
    db.close()
"""

from __future__ import annotations

import time
import uuid
import logging
from typing import Optional

from sqlalchemy import text
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from .auth import authenticate, validate_mode
from .schema import extract_schema, serialize_to_sql_ctx
from .cache import SchemaCache
from .exceptions import (
    AuthError,
    ConnectionError as DHConnectionError,
    SchemaExtractionError,
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
    ) -> None:
        self._engine = engine
        self._mode = mode
        self._session_id = session_id
        self._schema_cache = schema_cache
        self._dialect = dialect
        self._closed = False

    # ─────────────────────────────────────────
    # Factory
    # ─────────────────────────────────────────

    @classmethod
    def connect(
        cls,
        host: str,
        user: str,
        password: str,
        dbname: str,
        port: int = 5432,
        mode: str = "user",
        ttl: int = 3600,
        dialect: str = "postgresql",
        schema_on_connect: bool = True,
    ) -> "Arivu":
        """
        Authenticate, verify mode, extract schema, and return a ready connection.

        Raises:
            AuthError              — bad credentials or unreachable host
            ConnectionError        — TCP / network failure
            SchemaExtractionError  — introspection failed after auth
            ValueError             — invalid mode
        """
        validate_mode(mode)

        print(f"\n◀  Arivu.connect()  {dialect}://{host}:{port}/{dbname}  mode={mode}", flush=True)
        logger.info(f"Connecting to {dialect}://{host}:{port}/{dbname} as mode={mode}")

        # ── Step 1: auth + build engine ──────────────
        engine = authenticate(
            host=host,
            port=port,
            user=user,
            password=password,
            dbname=dbname,
            dialect=dialect,
        )

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
        )

        logger.info(
            f"Connection ready  session_id={session_id}  mode={mode}  "
            f"schema_cached={'yes' if schema_cache.is_valid() else 'no'}"
        )
        print(f"✔  Connected  session={session_id[:12]}  schema={'cached' if schema_cache.is_valid() else 'empty'}\n", flush=True)
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