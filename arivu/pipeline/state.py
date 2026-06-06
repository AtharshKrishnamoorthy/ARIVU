"""
arivu.pipeline.state
───────────────────────────
GraphState is the single shared object that flows through every node
in the LangGraph pipeline. Every node reads from it and writes back to it.

Nothing is stored outside this object during a pipeline run — no globals,
no side effects. This makes the graph fully inspectable and replayable.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class GraphState:
    """
    Shared state for the Arivu LangGraph pipeline.

    Populated progressively as the graph executes:

        query_intake      — fills: question, schema_ctx, vector_store,
                                   session_id, mode, engine, retry_count
        sql_generator     — fills: sql
        query_verifier    — fills: verified (bool), verifier_error
        db_execution      — fills: raw_result
        result_embedder   — fills: result_vector_store
        retrieval_agent   — fills: retrieved_chunks
        result_verifier   — fills: result_verified (bool), result_verifier_error
        response_gen      — fills: response
        memory_write      — fills: trace_event (and persists to memory layer)
        rlhf_feedback     — fills: rlhf_signal
    """

    # ── Input (set before graph entry) ──────────────────────────────────
    original_question: str = ""       # raw unadulterated question for DB storage
    question: str = ""
    schema_ctx: str = ""
    vector_store: Any = None          # FAISS schema vector store
    session_id: str = ""
    mode: str = "user"                # "user" | "admin"
    engine: Any = None                # SQLAlchemy engine
    dialect: str = ""                 # "postgresql" | "mysql" | "sqlite" | "snowflake" | "databricks"
    connection_meta: dict = field(default_factory=dict)  # {dialect, host, port, dbname, ...}
    interface: str = "dashboard"      # Originating platform (e.g., "dashboard", "slack")
    db_alias: str = ""                # Active database alias for memory scoping

    # ── SQL generation ───────────────────────────────────────────────────
    sql: str = ""
    retry_count: int = 0
    max_retries: int = 3
    verifier_error: str = ""          # fed back into SQL generator on retry

    # ── DB execution ─────────────────────────────────────────────────────
    raw_result: list[dict] = field(default_factory=list)

    # ── RAG / retrieval ──────────────────────────────────────────────────
    result_vector_store: Any = None   # FAISS result vector store
    retrieved_chunks: list[str] = field(default_factory=list)
    result_verifier_error: str = ""
    result_retry_count: int = 0
    max_result_retries: int = 2

    # ── Response ─────────────────────────────────────────────────────────
    response: str = ""

    # ── Error handling ───────────────────────────────────────────────────
    error: Optional[str] = None       # set by any error boundary
    error_node: Optional[str] = None  # which node raised the error
    error_type: Optional[str] = None  # class name of the exception

    # ── Admin / RLHF ─────────────────────────────────────────────────────
    requires_approval: bool = False   # True when destructive SQL in admin mode
    approved: Optional[bool] = None   # None = pending, True/False = decided
    rlhf_signal: Optional[str] = None # "positive" | "negative" | "correction"

    # ── Tracing ──────────────────────────────────────────────────────────
    trace_events: list[dict] = field(default_factory=list)

    # ─────────────────────────────────────────
    # Helpers
    # ─────────────────────────────────────────

    def has_error(self) -> bool:
        return self.error is not None

    def record_trace(
        self,
        node: str,
        status: str,
        latency_ms: float,
        detail: Optional[str] = None,
    ) -> None:
        """Append a trace event. Called by every node."""
        import time
        self.trace_events.append({
            "node": node,
            "status": status,          # "ok" | "fail" | "retry" | "skip"
            "latency_ms": round(latency_ms, 2),
            "detail": detail or "",
            "ts": time.time(),
        })

    def set_error(self, node: str, exc: Exception) -> None:
        """Populate error fields from a caught exception."""
        self.error = str(exc)
        self.error_node = node
        self.error_type = type(exc).__name__