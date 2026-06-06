"""
arivu.memory.store
─────────────────────────
Public API for the memory layer.
All pipeline nodes call these functions directly.

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

# ── Singleton backend instance (thread-safe) ──────────────────────────────────
import threading

_backend = None
_backend_lock = threading.Lock()

def _get_backend():
    global _backend
    if _backend is None:
        with _backend_lock:
            if _backend is None:
                backend_type = os.environ.get("ARIVU_MEMORY_BACKEND", "sqlite")
                _backend = get_backend(backend_type)
    return _backend


# ─────────────────────────────────────────────────────────────────────────────
# Session history
# ─────────────────────────────────────────────────────────────────────────────

def load_session_history(session_id: str, limit: int = 3, db_alias: str = "") -> list[dict]:
    try:
        return _get_backend().load_session_history(session_id, limit=limit, db_alias=db_alias)
    except Exception as exc:
        logger.warning(f"[memory] load_session_history failed: {exc}")
        return []


def save_interaction(
    session_id: str,
    question: str,
    sql: str,
    response: str,
    trace_events: list[dict],
    db_alias: str = "",
    dialect: str = "",
    connection_meta: dict = None,
    interface: str = "dashboard",
) -> None:
    enriched_events = list(trace_events)
    if dialect or connection_meta:
        enriched_events.insert(0, {
            "node": "__meta__",
            "status": "ok",
            "latency_ms": 0,
            "dialect": dialect,
            "connection_meta": connection_meta or {},
        })
    try:
        _get_backend().save_interaction(
            session_id=session_id,
            question=question,
            sql=sql,
            response=response,
            trace_events=enriched_events,
            db_alias=db_alias,
            dialect=dialect,
            interface=interface,
        )
    except Exception as exc:
        logger.warning(f"[memory] save_interaction failed: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# Admin approval flow
# ─────────────────────────────────────────────────────────────────────────────

def save_pending_approval(
    session_id: str,
    sql: str,
    question: str,
    db_alias: str = "",
) -> None:
    try:
        _get_backend().save_pending_approval(
            session_id=session_id,
            sql=sql,
            question=question,
            db_alias=db_alias,
        )
    except Exception as exc:
        logger.warning(f"[memory] save_pending_approval failed: {exc}")


def get_pending_approval(session_id: str, db_alias: str = "") -> Optional[dict]:
    try:
        return _get_backend().get_pending_approval(session_id, db_alias=db_alias)
    except Exception as exc:
        logger.warning(f"[memory] get_pending_approval failed: {exc}")
        return None


def resolve_approval(session_id: str, approved: bool, db_alias: str = "") -> None:
    try:
        _get_backend().resolve_approval(session_id, approved, db_alias=db_alias)
    except Exception as exc:
        logger.warning(f"[memory] resolve_approval failed: {exc}")


def get_all_pending_approvals(db_alias: str = "") -> list[dict]:
    try:
        return _get_backend().get_all_pending_approvals(db_alias=db_alias)
    except Exception as exc:
        logger.warning(f"[memory] get_all_pending_approvals failed: {exc}")
        return []


# ─────────────────────────────────────────────────────────────────────────────
# RLHF feedback
# ─────────────────────────────────────────────────────────────────────────────

def save_rlhf_signal(
    session_id: str,
    question: str,
    sql: str,
    signal: str,
    approved: Optional[bool] = None,
    db_alias: str = "",
    dialect: str = "",
    interface: str = "dashboard",
) -> None:
    try:
        _get_backend().save_rlhf_signal(
            session_id=session_id,
            question=question,
            sql=sql,
            signal=signal,
            approved=approved,
            db_alias=db_alias,
            dialect=dialect,
            interface=interface,
        )
    except Exception as exc:
        logger.warning(f"[memory] save_rlhf_signal failed: {exc}")


def get_rlhf_log(
    limit: int = 100,
    signal_filter: Optional[str] = None,
    db_alias: str = "",
) -> list[dict]:
    try:
        return _get_backend().get_rlhf_log(limit=limit, signal_filter=signal_filter, db_alias=db_alias)
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
    db_alias: str = "",
    dialect: str = "",
    connection_meta: dict = None,
    interface: str = "dashboard",
) -> None:
    try:
        _get_backend().save_error_event(
            session_id=session_id,
            error=error,
            error_node=error_node,
            error_type=error_type,
            question=question,
            sql=sql,
            trace_events=trace_events,
            db_alias=db_alias,
            dialect=dialect,
            connection_meta=connection_meta,
            interface=interface,
        )
    except Exception as exc:
        logger.warning(f"[memory] save_error_event failed: {exc}")


def get_error_log(limit: int = 100, db_alias: str = "") -> list[dict]:
    try:
        return _get_backend().get_error_log(limit=limit, db_alias=db_alias)
    except Exception as exc:
        logger.warning(f"[memory] get_error_log failed: {exc}")
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Dashboard trace queries
# ─────────────────────────────────────────────────────────────────────────────

def get_pipeline_traces(
    session_id: Optional[str] = None,
    limit: int = 50,
    db_alias: str = "",
) -> list[dict]:
    try:
        return _get_backend().get_pipeline_traces(session_id=session_id, limit=limit, db_alias=db_alias)
    except Exception as exc:
        logger.warning(f"[memory] get_pipeline_traces failed: {exc}")
        return []


def get_session_list(limit: int = 50, db_alias: str = "") -> list[dict]:
    try:
        return _get_backend().get_session_list(limit=limit, db_alias=db_alias)
    except Exception as exc:
        logger.warning(f"[memory] get_session_list failed: {exc}")
        return []


def get_dashboard_stats(db_alias: str = "") -> dict:
    try:
        return _get_backend().get_dashboard_stats(db_alias=db_alias)
    except Exception as exc:
        logger.warning(f"[memory] get_dashboard_stats failed: {exc}")
        return {
            "total_sessions": 0, "total_queries": 0, "total_errors": 0,
            "error_rate": 0.0, "positive_rlhf": 0, "negative_rlhf": 0,
            "avg_latency_ms": 0.0, "node_avg_latency": {}
        }


# ─────────────────────────────────────────────────────────────────────────────
# Saved Queries
# ─────────────────────────────────────────────────────────────────────────────

def save_saved_query(
    query_id: str,
    session_id: str,
    query: str,
    sql: str,
    notes: str = "",
    db_alias: str = "",
) -> None:
    try:
        _get_backend().save_saved_query(
            query_id=query_id,
            session_id=session_id,
            query=query,
            sql=sql,
            notes=notes,
            db_alias=db_alias,
        )
    except Exception as exc:
        logger.warning(f"[memory] save_saved_query failed: {exc}")


def get_saved_query(query_id: str, db_alias: str = "") -> Optional[dict]:
    try:
        return _get_backend().get_saved_query(query_id, db_alias=db_alias)
    except Exception as exc:
        logger.warning(f"[memory] get_saved_query failed: {exc}")
        return None


def list_saved_queries(limit: int = 50, offset: int = 0, db_alias: str = "") -> list[dict]:
    try:
        return _get_backend().list_saved_queries(limit=limit, offset=offset, db_alias=db_alias)
    except Exception as exc:
        logger.warning(f"[memory] list_saved_queries failed: {exc}")
        return []


def list_session_saved_queries(session_id: str, limit: int = 50, db_alias: str = "") -> list[dict]:
    try:
        return _get_backend().list_session_saved_queries(session_id=session_id, limit=limit, db_alias=db_alias)
    except Exception as exc:
        logger.warning(f"[memory] list_session_saved_queries failed: {exc}")
        return []


def update_saved_query(query_id: str, notes: str, db_alias: str = "") -> None:
    try:
        _get_backend().update_saved_query(query_id=query_id, notes=notes, db_alias=db_alias)
    except Exception as exc:
        logger.warning(f"[memory] update_saved_query failed: {exc}")


def delete_saved_query(query_id: str, db_alias: str = "") -> None:
    try:
        _get_backend().delete_saved_query(query_id=query_id, db_alias=db_alias)
    except Exception as exc:
        logger.warning(f"[memory] delete_saved_query failed: {exc}")


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
        active = _get_backend().get_config("active_llm")
        if active and active.get("id"):
            entry = _get_backend().get_config(f"llm:{active['id']}")
            if entry:
                return entry
        return _get_backend().get_config("llm")
    except Exception as exc:
        logger.warning(f"[memory] get_llm_config failed: {exc}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# LLM Store — multiple configs with activation
# ─────────────────────────────────────────────────────────────────────────────

def save_llm_entry(entry_id: str, config: dict) -> None:
    """Save an LLM config entry under key 'llm:{id}'."""
    try:
        _get_backend().save_config(f"llm:{entry_id}", config)
    except Exception as exc:
        logger.warning(f"[memory] save_llm_entry failed: {exc}")

def list_llm_entries() -> list[dict]:
    """Return all stored LLM configs with their IDs."""
    try:
        entries = _get_backend().get_configs_by_prefix("llm:")
        active_data = _get_backend().get_config("active_llm")
        active_id = active_data.get("id") if active_data else None
        return [
            {
                "id": k,
                "name": v.get("name", "Unnamed"),
                "provider": v.get("provider", ""),
                "model": v.get("model", ""),
                "is_active": k == active_id,
                "created_at": v.get("created_at", 0),
            }
            for k, v in entries.items()
        ]
    except Exception as exc:
        logger.warning(f"[memory] list_llm_entries failed: {exc}")
        return []

def activate_llm_entry(entry_id: str) -> None:
    """Set the given entry as the active LLM config."""
    try:
        _get_backend().save_config("active_llm", {"id": entry_id})
        # Also update the legacy "llm" key for backward compat
        entry = _get_backend().get_config(f"llm:{entry_id}")
        if entry:
            _get_backend().save_config("llm", entry)
    except Exception as exc:
        logger.warning(f"[memory] activate_llm_entry failed: {exc}")

def delete_llm_entry(entry_id: str) -> None:
    """Remove an LLM config entry."""
    try:
        backend = _get_backend()
        backend.save_config(f"llm:{entry_id}", {})
        # If this was active, clear active
        active = backend.get_config("active_llm")
        if active and active.get("id") == entry_id:
            backend.save_config("active_llm", {})
    except Exception as exc:
        logger.warning(f"[memory] delete_llm_entry failed: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# Integrations Store — media/messaging platform configs
# ─────────────────────────────────────────────────────────────────────────────

INTEGRATION_PLATFORMS = ["slack", "discord", "telegram", "whatsapp", "webhook", "email"]

def save_integration(platform: str, config: dict) -> None:
    """Save an integration config for the given platform."""
    try:
        _get_backend().save_config(f"integration:{platform}", config)
    except Exception as exc:
        logger.warning(f"[memory] save_integration failed: {exc}")

def get_integration(platform: str) -> Optional[dict]:
    """Return the integration config for a platform, or None if not configured."""
    try:
        data = _get_backend().get_config(f"integration:{platform}")
        return data if data else None
    except Exception as exc:
        logger.warning(f"[memory] get_integration failed: {exc}")
        return None

def list_integrations() -> list[dict]:
    """Return all integration entries with their platform keys and enabled status."""
    try:
        entries = _get_backend().get_configs_by_prefix("integration:")
        result = []
        for key, val in entries.items():
            if not val:  # empty dict = deleted/unconfigured
                continue
            result.append({
                "platform": key,  # e.g. "telegram"
                "enabled": val.get("enabled", True),
                "configured": True,
                **{k: v for k, v in val.items() if k not in ("enabled",)},
            })
        return result
    except Exception as exc:
        logger.warning(f"[memory] list_integrations failed: {exc}")
        return []

def delete_integration(platform: str) -> None:
    """Remove an integration config."""
    try:
        _get_backend().save_config(f"integration:{platform}", {})
    except Exception as exc:
        logger.warning(f"[memory] delete_integration failed: {exc}")
