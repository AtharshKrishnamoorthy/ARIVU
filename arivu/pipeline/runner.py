"""
arivu.pipeline.runner
────────────────────────────
The public entry point for running the agentic pipeline.

Takes the dict returned by db.query() and runs it through the
compiled LangGraph, returning a clean PipelineResult.

Synchronous usage:
    from arivu.pipeline.runner import run_pipeline

    pipeline_input = db.query("show me top 10 orders")
    result = run_pipeline(pipeline_input)
    print(result.response)

Async usage (FastAPI, async integrations, non-blocking):
    from arivu.pipeline.runner import run_pipeline_async

    pipeline_input = db.query("show me top 10 orders")
    result = await run_pipeline_async(pipeline_input)

For human-readable CLI output pass a print-based progress callback:
    from arivu.pipeline.runner import run_pipeline
    result = run_pipeline(pipeline_input, progress_callback=print)

Rate limiting & resource control:
    from arivu.pipeline.runner import PipelineConfig, run_pipeline

    config = PipelineConfig(max_query_chars=2000, max_result_rows=500)
    result = run_pipeline(pipeline_input, config=config)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from .state import GraphState
from .graph import get_compiled_graph
from .progress import ProgressLogger

logger = logging.getLogger("arivu.pipeline.runner")


# ═══════════════════════════════════════════════════════════════════════════════
# PipelineConfig — rate limiting & resource guards (PROD-07)
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class PipelineConfig:
    """
    Rate limiting and resource budget controls for a pipeline run.

    Attach to run_pipeline() or run_pipeline_async() to enforce limits:
      - max_query_chars:  reject queries longer than this (guard against prompt
                          bloat and token budget exhaustion)
      - max_result_rows:  truncate result sets beyond this (prevent OOM when a
                          broad SELECT returns millions of rows)
      - max_retries:      maximum SQL-generation retry attempts (passed to
                          the GraphState for the query verifier to honour)
    """
    max_query_chars: int = 10_000
    max_result_rows: int = 10_000
    max_retries: int = 3

    def validate_query(self, question: str) -> tuple[bool, str]:
        """
        Check whether the NL question is within the configured length budget.

        Returns (True, "") on pass, (False, reason) on rejection.
        """
        if len(question) > self.max_query_chars:
            return False, (
                f"Query too long ({len(question)} chars). "
                f"Maximum allowed: {self.max_query_chars} chars."
            )
        return True, ""


# ═══════════════════════════════════════════════════════════════════════════════
# PipelineResult
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class PipelineResult:
    """
    Clean result object returned to the caller after a pipeline run.

    Attributes:
        response         — natural language answer (always set, even on error)
        sql              — the SQL that was generated and executed
        raw_result       — raw list of dicts from the DB (truncated to config limit)
        error            — error message if pipeline hit an error boundary
        error_node       — which node caused the error
        requires_approval— True if a destructive SQL is awaiting admin approval
        session_id       — session identifier
        trace_events     — ordered list of trace events from every node
        results_truncated— True when raw_result was clipped to max_result_rows
    """
    response: str = ""
    sql: str = ""
    raw_result: list[dict] = field(default_factory=list)
    error: Optional[str] = None
    error_node: Optional[str] = None
    requires_approval: bool = False
    approved: Optional[bool] = None
    session_id: str = ""
    trace_events: list[dict] = field(default_factory=list)
    results_truncated: bool = False

    @property
    def success(self) -> bool:
        return self.error is None

    @property
    def pending_approval(self) -> bool:
        return self.requires_approval and self.approved is None

    def __repr__(self) -> str:
        status = "ok" if self.success else f"error({self.error_node})"
        return (
            f"<PipelineResult status={status}  "
            f"sql='{self.sql[:40]}...'  "
            f"response='{self.response[:60]}...'>"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# Internal helpers
# ═══════════════════════════════════════════════════════════════════════════════

DEFAULT_CONFIG = PipelineConfig()


def _build_initial_state(
    pipeline_input: dict,
    rlhf_signal: Optional[str],
    config: PipelineConfig,
) -> GraphState:
    """Construct the initial GraphState from the connection's query output."""
    return GraphState(
        question=pipeline_input["question"],
        schema_ctx=pipeline_input["schema_ctx"],
        vector_store=pipeline_input["vector_store"],
        session_id=pipeline_input["session_id"],
        mode=pipeline_input["mode"],
        engine=pipeline_input["engine"],
        dialect=pipeline_input.get("dialect", ""),
        connection_meta=pipeline_input.get("connection_meta", {}),
        interface=pipeline_input.get("interface", "dashboard"),
        db_alias=pipeline_input.get("db_alias", ""),
        rlhf_signal=rlhf_signal,
        max_retries=config.max_retries,
    )


def _build_result(final: dict, config: PipelineConfig) -> PipelineResult:
    """Build a PipelineResult from the final graph state, applying row limits."""
    raw_result = final.get("raw_result", [])
    truncated = False

    if len(raw_result) > config.max_result_rows:
        logger.warning(
            f"Result set truncated  "
            f"total_rows={len(raw_result)}  "
            f"limit={config.max_result_rows}"
        )
        raw_result = raw_result[:config.max_result_rows]
        truncated = True

    return PipelineResult(
        response=final.get("response", ""),
        sql=final.get("sql", ""),
        raw_result=raw_result,
        error=final.get("error"),
        error_node=final.get("error_node"),
        requires_approval=final.get("requires_approval", False),
        approved=final.get("approved"),
        session_id=final.get("session_id", ""),
        trace_events=final.get("trace_events", []),
        results_truncated=truncated,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Public API — synchronous
# ═══════════════════════════════════════════════════════════════════════════════

def run_pipeline(
    pipeline_input: dict,
    rlhf_signal: Optional[str] = None,
    *,
    config: Optional[PipelineConfig] = None,
    progress_callback: Optional[Callable[[str], None]] = None,
) -> PipelineResult:
    """
    Execute the full LangGraph pipeline for a single query (synchronous).

    Args:
        pipeline_input:    dict from db.query() containing question, schema_ctx,
                           vector_store, session_id, mode, engine
        rlhf_signal:       optional RLHF signal ("positive" | "negative")
        config:            optional PipelineConfig for rate/resource limits.
                           If None, sensible defaults (10K chars, 10K rows) are used.
        progress_callback: optional human-readable progress callback
                           (e.g. pass print for CLI, None for library mode)

    Returns:
        PipelineResult
    """
    cfg = config or DEFAULT_CONFIG

    question: str = pipeline_input.get("question", "")

    ok, reason = cfg.validate_query(question)
    if not ok:
        logger.warning(f"Pipeline rejected: {reason}")
        return PipelineResult(
            response=f"Query rejected: {reason}",
            error=reason,
            error_node="runner",
            session_id=pipeline_input.get("session_id", ""),
        )

    pl = ProgressLogger(callback=progress_callback)
    ProgressLogger.set_active(pl)

    graph = get_compiled_graph()
    initial_state = _build_initial_state(pipeline_input, rlhf_signal, cfg)

    pl.log_start(
        session_id=initial_state.session_id,
        mode=initial_state.mode,
        question=initial_state.question,
    )
    logger.info(
        f"Pipeline starting  "
        f"session={initial_state.session_id}  "
        f"mode={initial_state.mode}  "
        f"q='{initial_state.question[:60]}'"
    )

    try:
        final: dict = initial_state.__dict__.copy()
        for chunk in graph.stream(initial_state, stream_mode="values"):
            final = chunk
            if "trace_events" in final and final["trace_events"]:
                last_node = final["trace_events"][-1].get("node", "unknown")
                pl.log(last_node, detail="completed")
    except Exception as exc:
        pl.log_crash(str(exc))
        logger.critical(f"Unhandled pipeline exception: {exc}", exc_info=True)
        return PipelineResult(
            response="An unexpected error occurred. Please try again.",
            sql="",
            error=str(exc),
            error_node="runner",
            session_id=initial_state.session_id,
        )

    nodes_run = len(final.get("trace_events", []))
    err = final.get("error")
    pl.log_end(nodes_run=nodes_run, error=err)
    logger.info(
        f"Pipeline complete  "
        f"session={final.get('session_id', '')}  "
        f"nodes_executed={nodes_run}  "
        f"error={err}"
    )

    return _build_result(final, cfg)


# ═══════════════════════════════════════════════════════════════════════════════
# Public API — asynchronous  (PROD-05)
# ═══════════════════════════════════════════════════════════════════════════════

async def run_pipeline_async(
    pipeline_input: dict,
    rlhf_signal: Optional[str] = None,
    *,
    config: Optional[PipelineConfig] = None,
    progress_callback: Optional[Callable[[str], None]] = None,
) -> PipelineResult:
    """
    Execute the full LangGraph pipeline for a single query (asynchronous).

    Identical to run_pipeline() but uses graph.ainvoke() so it can be
    awaited inside async FastAPI routes, async Telegram handlers, and
    other asyncio-based integrations without blocking the event loop.

    Args:
        pipeline_input:    dict from db.query() containing question, schema_ctx,
                           vector_store, session_id, mode, engine
        rlhf_signal:       optional RLHF signal ("positive" | "negative")
        config:            optional PipelineConfig for rate/resource limits
        progress_callback: optional human-readable progress callback

    Returns:
        PipelineResult

    Example (FastAPI):
        @app.post("/query")
        async def query_endpoint(body: QueryBody):
            pipeline_input = db.query(body.question)
            result = await run_pipeline_async(pipeline_input)
            return {"response": result.response, "sql": result.sql}
    """
    cfg = config or DEFAULT_CONFIG

    question: str = pipeline_input.get("question", "")

    ok, reason = cfg.validate_query(question)
    if not ok:
        logger.warning(f"Pipeline rejected (async): {reason}")
        return PipelineResult(
            response=f"Query rejected: {reason}",
            error=reason,
            error_node="runner",
            session_id=pipeline_input.get("session_id", ""),
        )

    pl = ProgressLogger(callback=progress_callback)
    ProgressLogger.set_active(pl)

    graph = get_compiled_graph()
    initial_state = _build_initial_state(pipeline_input, rlhf_signal, cfg)

    pl.log_start(
        session_id=initial_state.session_id,
        mode=initial_state.mode,
        question=initial_state.question,
    )
    logger.info(
        f"Pipeline starting (async)  "
        f"session={initial_state.session_id}  "
        f"mode={initial_state.mode}  "
        f"q='{initial_state.question[:60]}'"
    )

    try:
        final: dict = await graph.ainvoke(initial_state)
    except Exception as exc:
        pl.log_crash(str(exc))
        logger.critical(
            f"Unhandled async pipeline exception: {exc}", exc_info=True
        )
        return PipelineResult(
            response="An unexpected error occurred. Please try again.",
            sql="",
            error=str(exc),
            error_node="runner",
            session_id=initial_state.session_id,
        )

    nodes_run = len(final.get("trace_events", []))
    err = final.get("error")
    pl.log_end(nodes_run=nodes_run, error=err)
    logger.info(
        f"Pipeline complete (async)  "
        f"session={final.get('session_id', '')}  "
        f"nodes_executed={nodes_run}  "
        f"error={err}"
    )

    return _build_result(final, cfg)