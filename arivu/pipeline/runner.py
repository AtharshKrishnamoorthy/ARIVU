"""
arivu.pipeline.runner
────────────────────────────
The public entry point for running the agentic pipeline.

Takes the dict returned by db.query() and runs it through the
compiled LangGraph, returning a clean PipelineResult.

Usage:
    from arivu.pipeline.runner import run_pipeline

    pipeline_input = db.query("show me top 10 orders")
    result = run_pipeline(pipeline_input)

    print(result.response)
    print(result.sql)
    print(result.trace_events)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Optional

from .state import GraphState
from .graph import get_compiled_graph

logger = logging.getLogger("arivu.pipeline.runner")


@dataclass
class PipelineResult:
    """
    Clean result object returned to the caller after a pipeline run.

    Attributes:
        response      — natural language answer (always set, even on error)
        sql           — the SQL that was generated and executed
        raw_result    — raw list of dicts from the DB
        error         — error message if pipeline hit an error boundary
        error_node    — which node caused the error
        requires_approval — True if a destructive SQL is awaiting admin approval
        session_id    — session identifier
        trace_events  — ordered list of trace events from every node
    """
    response: str
    sql: str
    raw_result: list[dict] = field(default_factory=list)
    error: Optional[str] = None
    error_node: Optional[str] = None
    requires_approval: bool = False
    approved: Optional[bool] = None
    session_id: str = ""
    trace_events: list[dict] = field(default_factory=list)

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


def run_pipeline(pipeline_input: dict, rlhf_signal: Optional[str] = None) -> PipelineResult:
    """
    Execute the full LangGraph pipeline for a single query.

    Args:
        pipeline_input:  dict from db.query() containing question, schema_ctx,
                         vector_store, session_id, mode, engine
        rlhf_signal:     optional RLHF signal to attach ("positive" | "negative")

    Returns:
        PipelineResult
    """
    graph = get_compiled_graph()

    # Build initial GraphState from the connection's query output
    initial_state = GraphState(
        question=pipeline_input["question"],
        schema_ctx=pipeline_input["schema_ctx"],
        vector_store=pipeline_input["vector_store"],
        session_id=pipeline_input["session_id"],
        mode=pipeline_input["mode"],
        engine=pipeline_input["engine"],
        rlhf_signal=rlhf_signal,
    )

    print(f"\n{'='*60}", flush=True)
    print(f"▶  PIPELINE START  session={initial_state.session_id[:12]}  mode={initial_state.mode}", flush=True)
    print(f"   question: {initial_state.question[:80]}", flush=True)
    print(f"{'='*60}", flush=True)
    logger.info(
        f"Pipeline starting  "
        f"session={initial_state.session_id}  "
        f"mode={initial_state.mode}  "
        f"q='{initial_state.question[:60]}'"
    )

    try:
        final: dict = graph.invoke(initial_state)
    except Exception as exc:
        # Should never reach here — error_boundary handles all exceptions.
        # This is a last-resort safety net.
        print(f"✖  PIPELINE CRASHED  error={exc}", flush=True)
        logger.critical(f"Unhandled pipeline exception: {exc}", exc_info=True)
        return PipelineResult(
            response="An unexpected error occurred. Please try again.",
            sql="",
            error=str(exc),
            error_node="runner",
            session_id=initial_state.session_id,
        )

    nodes_run = len(final.get('trace_events', []))
    err = final.get('error')
    status_icon = "✔" if not err else "✖"
    print(f"{status_icon}  PIPELINE DONE  nodes={nodes_run}  error={err}", flush=True)
    print(f"{'='*60}\n", flush=True)
    logger.info(
        f"Pipeline complete  "
        f"session={final.get('session_id', '')}  "
        f"nodes_executed={nodes_run}  "
        f"error={err}"
    )

    return PipelineResult(
        response=final.get("response", ""),
        sql=final.get("sql", ""),
        raw_result=final.get("raw_result", []),
        error=final.get("error"),
        error_node=final.get("error_node"),
        requires_approval=final.get("requires_approval", False),
        approved=final.get("approved"),
        session_id=final.get("session_id", ""),
        trace_events=final.get("trace_events", []),
    )