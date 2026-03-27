"""
arivu.memory.store
─────────────────────────
Public API for the memory layer.
All pipeline nodes call these functions directly.

Functions:
    load_session_history(session_id, limit=3)      → list[dict]
    save_interaction(...)                 → None
    save_pending_approval(...)            → None
    save_rlhf_signal(...)                 → None
    save_error_event(...)                 → None
    get_pending_approval(session_id)      → dict | None
    resolve_approval(session_id, approve) → None

Storage backend is selected via ARIVU_MEMORY_BACKEND env var:
    "sqlite"  (default) — zero-infra, single file, great for dev + small prod
    "redis"             — for multi-instance / high-throughput deployments
"""

from __future__ import annotations

import os
import logging
from typing import Optional

from .backend import get_backend

logger = logging.getLogger("arivu.memory")

# ── Singleton backend instance ────────────────────────────────────────────────
_backend = None

def _get_backend():
    global _backend
    if _backend is None:
        backend_type = os.environ.get("ARIVU_MEMORY_BACKEND", "sqlite")
        _backend = get_backend(backend_type)
    return _backend


# ─────────────────────────────────────────────────────────────────────────────
# Session history
# ─────────────────────────────────────────────────────────────────────────────

def load_session_history(session_id: str, limit: int = 3) -> list[dict]:
    """
    Return the last `limit` interactions for this session.
    Kept small (default=3) to avoid bloating the LLM prompt and hitting TPM limits.

    Each entry:
        {
            "question":  str,
            "sql":       str,
            "response":  str,
            "ts":        float,
        }
    """
    try:
        return _get_backend().load_session_history(session_id, limit=limit)
    except Exception as exc:
        logger.warning(f"[memory] load_session_history failed: {exc}")
        return []


def save_interaction(
    session_id: str,
    question: str,
    sql: str,
    response: str,
    trace_events: list[dict],
) -> None:
    """
    Persist a completed NL → SQL → response interaction.
    Called by memory_write_node at the end of every successful pipeline run.
    Also emits the trace events to the dashboard store.
    """
    try:
        _get_backend().save_interaction(
            session_id=session_id,
            question=question,
            sql=sql,
            response=response,
            trace_events=trace_events,
        )
        logger.debug(f"[memory] interaction saved  session={session_id}")
    except Exception as exc:
        logger.warning(f"[memory] save_interaction failed: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# Admin approval flow
# ─────────────────────────────────────────────────────────────────────────────

def save_pending_approval(
    session_id: str,
    sql: str,
    question: str,
) -> None:
    """
    Persist a destructive SQL awaiting human approval.
    Called by admin_approval_node.
    The integration layer polls this to surface the request to the admin.
    """
    try:
        _get_backend().save_pending_approval(
            session_id=session_id,
            sql=sql,
            question=question,
        )
        logger.info(f"[memory] pending approval saved  session={session_id}")
    except Exception as exc:
        logger.warning(f"[memory] save_pending_approval failed: {exc}")


def get_pending_approval(session_id: str) -> Optional[dict]:
    """
    Fetch a pending approval record for a session.
    Returns None if no pending approval exists.

    Returns:
        {
            "session_id": str,
            "sql":        str,
            "question":   str,
            "ts":         float,
            "resolved":   bool,
            "approved":   bool | None,
        }
    """
    try:
        return _get_backend().get_pending_approval(session_id)
    except Exception as exc:
        logger.warning(f"[memory] get_pending_approval failed: {exc}")
        return None


def resolve_approval(session_id: str, approved: bool) -> None:
    """
    Mark a pending approval as resolved (approved or rejected).
    Called by the integration layer when the admin responds.
    """
    try:
        _get_backend().resolve_approval(session_id, approved)
        action = "approved" if approved else "rejected"
        logger.info(f"[memory] approval {action}  session={session_id}")
    except Exception as exc:
        logger.warning(f"[memory] resolve_approval failed: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# RLHF feedback
# ─────────────────────────────────────────────────────────────────────────────

def save_rlhf_signal(
    session_id: str,
    question: str,
    sql: str,
    signal: str,
    approved: Optional[bool] = None,
) -> None:
    """
    Persist an RLHF feedback signal.
    Called by rlhf_feedback_node.

    signal:   "positive" | "negative" | "correction"
    approved: True/False for admin mode approval decisions, None for user feedback
    """
    try:
        _get_backend().save_rlhf_signal(
            session_id=session_id,
            question=question,
            sql=sql,
            signal=signal,
            approved=approved,
        )
        logger.debug(f"[memory] RLHF signal saved  signal={signal}  session={session_id}")
    except Exception as exc:
        logger.warning(f"[memory] save_rlhf_signal failed: {exc}")


def get_rlhf_log(
    limit: int = 100,
    signal_filter: Optional[str] = None,
) -> list[dict]:
    """
    Fetch recent RLHF entries for the dashboard RLHF log panel.

    Each entry:
        {
            "session_id": str,
            "question":   str,
            "sql":        str,
            "signal":     str,
            "approved":   bool | None,
            "ts":         float,
        }
    """
    try:
        return _get_backend().get_rlhf_log(limit=limit, signal_filter=signal_filter)
    except Exception as exc:
        logger.warning(f"[memory] get_rlhf_log failed: {exc}")
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Error events
# ─────────────────────────────────────────────────────────────────────────────

def save_error_event(
    session_id: str,
    error: str,
    error_node: str,
    error_type: str,
    question: str,
    sql: str,
    trace_events: list[dict],
) -> None:
    """
    Persist an error boundary event for the dashboard error log panel.
    Called by error_boundary_node.
    """
    try:
        _get_backend().save_error_event(
            session_id=session_id,
            error=error,
            error_node=error_node,
            error_type=error_type,
            question=question,
            sql=sql,
            trace_events=trace_events,
        )
        logger.debug(f"[memory] error event saved  node={error_node}  session={session_id}")
    except Exception as exc:
        logger.warning(f"[memory] save_error_event failed: {exc}")


def get_error_log(limit: int = 100) -> list[dict]:
    """
    Fetch recent error events for the dashboard error log panel.

    Each entry:
        {
            "session_id":  str,
            "error":       str,
            "error_node":  str,
            "error_type":  str,
            "question":    str,
            "sql":         str,
            "ts":          float,
        }
    """
    try:
        return _get_backend().get_error_log(limit=limit)
    except Exception as exc:
        logger.warning(f"[memory] get_error_log failed: {exc}")
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Dashboard trace queries
# ─────────────────────────────────────────────────────────────────────────────

def get_pipeline_traces(
    session_id: Optional[str] = None,
    limit: int = 50,
) -> list[dict]:
    """
    Fetch pipeline trace events for the dashboard pipeline trace panel.
    Optionally filtered by session_id.
    """
    try:
        return _get_backend().get_pipeline_traces(session_id=session_id, limit=limit)
    except Exception as exc:
        logger.warning(f"[memory] get_pipeline_traces failed: {exc}")
        return []


def get_session_list(limit: int = 50) -> list[dict]:
    """
    Fetch a summary list of recent sessions for the dashboard session panel.

    Each entry:
        {
            "session_id":     str,
            "query_count":    int,
            "last_question":  str,
            "last_ts":        float,
            "error_count":    int,
        }
    """
    try:
        return _get_backend().get_session_list(limit=limit)
    except Exception as exc:
        logger.warning(f"[memory] get_session_list failed: {exc}")
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Configuration wrappers (KV store)
# ─────────────────────────────────────────────────────────────────────────────

def save_connections(connections: list[dict]) -> None:
    try:
        _get_backend().save_config("connections", {"list": connections})
    except Exception as exc:
        logger.warning(f"[memory] save_connections failed: {exc}")

def get_connections() -> list[dict]:
    try:
        data = _get_backend().get_config("connections")
        return data.get("list", []) if data else []
    except Exception as exc:
        logger.warning(f"[memory] get_connections failed: {exc}")
        return []

def set_active_connection(alias: str) -> None:
    try:
        _get_backend().save_config("active_connection", {"alias": alias})
    except Exception as exc:
        logger.warning(f"[memory] set_active_connection failed: {exc}")

def get_active_connection() -> Optional[str]:
    try:
        data = _get_backend().get_config("active_connection")
        return data.get("alias") if data else None
    except Exception as exc:
        logger.warning(f"[memory] get_active_connection failed: {exc}")
        return None

def save_llm_config(config: dict) -> None:
    try:
        _get_backend().save_config("llm", config)
    except Exception as exc:
        logger.warning(f"[memory] save_llm_config failed: {exc}")

def get_llm_config() -> Optional[dict]:
    try:
        return _get_backend().get_config("llm")
    except Exception as exc:
        logger.warning(f"[memory] get_llm_config failed: {exc}")
        return None