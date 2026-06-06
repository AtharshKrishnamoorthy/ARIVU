"""
arivu.connection.cache
─────────────────────────────
Schema cache — holds the FAISS vector store, raw SQL context string,
and TTL metadata.  Lives on the Arivu connection object.

SchemaCache.is_stale()  — checked before every db.query()
SchemaCache.populate()  — called by both initial extraction and refresh

Uses time.monotonic() for TTL calculations (not wall-clock time) so
clock adjustments or DST transitions cannot trigger false staleness.
Schema fingerprinting detects structural DDL changes even before TTL expires.
"""

from __future__ import annotations

import hashlib
import json
import time
import logging
from typing import Any, Optional

logger = logging.getLogger("arivu.cache")

# Lazy imports — only pulled in when populate() is called so that
# users who haven't installed sentence-transformers/faiss don't hit an
# ImportError just from importing the module.
_faiss_store = None
_embeddings = None


def _get_embeddings():
    """Return a cached HuggingFace embedding model instance."""
    global _embeddings
    if _embeddings is None:
        try:
            from langchain_huggingface import HuggingFaceEmbeddings
            _embeddings = HuggingFaceEmbeddings(
                model_name="sentence-transformers/all-MiniLM-L6-v2",
                model_kwargs={"device": "cpu"},
            )
            logger.debug("HuggingFace embedding model loaded")
        except ImportError as exc:
            raise ImportError(
                "langchain-huggingface is required for schema embedding. "
                "Install it with: pip install langchain-huggingface"
            ) from exc
    return _embeddings


class SchemaCache:
    """
    Holds the embedded schema and its freshness metadata.

    Attributes:
        sql_ctx            — serialised CREATE TABLE string (raw text)
        vector_store       — FAISS index over chunked schema fragments
        raw_schema         — list of table dicts from extract_schema()
        cached_at          — monotonic timestamp of last successful population
        schema_fingerprint — hash of raw_schema for change detection
        ttl                — seconds before the cache is considered stale
    """

    def __init__(self, ttl: int = 3600) -> None:
        self.ttl: int = ttl
        self.sql_ctx: Optional[str] = None
        self.vector_store = None
        self.raw_schema: Optional[list[dict]] = None
        self.cached_at: Optional[float] = None
        self._schema_fingerprint: Optional[str] = None

    # ─────────────────────────────────────────
    # State checks
    # ─────────────────────────────────────────

    def is_valid(self) -> bool:
        """True if the cache has been populated at least once."""
        return self.cached_at is not None and self.sql_ctx is not None

    def is_stale(self) -> bool:
        """
        True if the cache has never been populated,
        or if the TTL has elapsed since the last population.

        Uses time.monotonic() — immune to wall-clock adjustments
        (NTP corrections, DST transitions, manual time changes).
        """
        if not self.is_valid():
            return True
        return (time.monotonic() - self.cached_at) > self.ttl

    @property
    def age_seconds(self) -> Optional[float]:
        """Seconds since the cache was last populated, or None if empty."""
        if self.cached_at is None:
            return None
        return time.monotonic() - self.cached_at

    @property
    def expires_in_seconds(self) -> Optional[float]:
        """Seconds until the cache expires, or None if already stale/empty."""
        if not self.is_valid():
            return None
        remaining = self.ttl - (time.monotonic() - self.cached_at)
        return max(0.0, remaining)

    @property
    def schema_fingerprint(self) -> Optional[str]:
        """SHA-256 hash of the raw schema dict, or None if never populated."""
        return self._schema_fingerprint

    # ─────────────────────────────────────────
    # Population
    # ─────────────────────────────────────────

    def populate(
        self,
        sql_ctx: str,
        raw_schema: list[dict[str, Any]],
    ) -> None:
        """
        Store the SQL context string, embed it into FAISS, and record
        the cache timestamp + schema fingerprint.

        The sql_ctx is split into per-table chunks so that retrieval
        returns only the relevant table fragments rather than the whole
        schema, keeping LLM context tight.
        """
        self.sql_ctx = sql_ctx
        self.raw_schema = raw_schema

        # Build FAISS store from per-table chunks
        chunks = _chunk_schema(sql_ctx)
        self.vector_store = _build_vector_store(chunks)

        self.cached_at = time.monotonic()
        self._schema_fingerprint = _compute_fingerprint(raw_schema)
        logger.info(
            f"Schema cache populated  "
            f"tables={len(raw_schema)}  "
            f"chunks={len(chunks)}  "
            f"ttl={self.ttl}s  "
            f"fingerprint={self._schema_fingerprint[:12]}"
        )

    def has_schema_changed(self, raw_schema: list[dict[str, Any]]) -> bool:
        """
        Compare the incoming raw schema against the cached fingerprint.

        Returns True if the schema structure has changed since last populate
        — even if the TTL hasn't expired. Use this to detect DDL changes
        (migrations, table adds/drops) before the next TTL window.
        """
        if self._schema_fingerprint is None:
            return True
        return _compute_fingerprint(raw_schema) != self._schema_fingerprint

    def invalidate(self) -> None:
        """Force the cache to be considered stale without clearing data."""
        self.cached_at = None
        logger.debug("Schema cache invalidated")

    def clear(self) -> None:
        """Wipe all cached data."""
        self.sql_ctx = None
        self.vector_store = None
        self.raw_schema = None
        self.cached_at = None
        self._schema_fingerprint = None
        logger.debug("Schema cache cleared")

    def __repr__(self) -> str:
        if not self.is_valid():
            return "<SchemaCache empty>"
        return (
            f"<SchemaCache "
            f"tables={len(self.raw_schema or [])}  "
            f"age={self.age_seconds:.0f}s  "
            f"ttl={self.ttl}s  "
            f"stale={self.is_stale()}>"
        )



# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _compute_fingerprint(raw_schema: list[dict[str, Any]]) -> str:
    """
    Compute a stable SHA-256 hash of the raw schema dict.

    Sorts table names + column names so the hash is deterministic
    regardless of introspection return order.
    """
    payload = json.dumps(raw_schema, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode()).hexdigest()


def _chunk_schema(sql_ctx: str) -> list[str]:
    """
    Split the SQL context into per-table chunks.
    Each chunk is a CREATE TABLE block + its index comments.
    Chunking by table means a query about 'orders' only retrieves
    the orders table context, not the entire schema.
    """
    chunks = []
    current: list[str] = []

    for line in sql_ctx.splitlines():
        if line.startswith("-- Table:") and current:
            chunk = "\n".join(current).strip()
            if chunk:
                chunks.append(chunk)
            current = [line]
        else:
            current.append(line)

    if current:
        chunk = "\n".join(current).strip()
        if chunk:
            chunks.append(chunk)

    logger.debug(f"Schema chunked into {len(chunks)} fragments")
    return chunks


def _build_vector_store(chunks: list[str]):
    """
    Embed the schema chunks and store in a FAISS index.
    Returns a LangChain FAISS vector store instance.
    """
    try:
        from langchain_community.vectorstores import FAISS
        from langchain_core.documents import Document
    except ImportError as exc:
        raise ImportError(
            "langchain-community is required for vector storage. "
            "Install it with: pip install langchain-community"
        ) from exc

    embeddings = _get_embeddings()
    docs = [
        Document(
            page_content=chunk,
            metadata={"source": "schema", "chunk_index": i},
        )
        for i, chunk in enumerate(chunks)
    ]

    store = FAISS.from_documents(docs, embeddings)
    logger.debug(f"FAISS index built with {len(docs)} documents")
    return store