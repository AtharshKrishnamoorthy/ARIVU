"""
arivu.dashboard.backend.routers.automations
────────────────────────────────────────────
CRUD endpoints for scheduled automations (cron jobs).

Each automation stores:
    - A natural-language query to run through the pipeline
    - A cron expression defining the schedule
    - An action to perform with the result (log, email, webhook)
    - Enabled/disabled toggle

All state is persisted in the SQLite memory backend via the
config KV store (key = "automations").
"""

import logging
import time
import uuid

from fastapi import APIRouter, Body, HTTPException

from ..dependencies import get_db_alias
from ....memory.store import _get_backend

logger = logging.getLogger("arivu.dashboard.automations")

router = APIRouter(prefix="/api/automations")


# ─────────────────────────────────────────────────────────────────────────────
# Helpers: read/write automations list via the existing config KV store
# ─────────────────────────────────────────────────────────────────────────────

def _load_automations(db_alias: str = "") -> list[dict]:
    try:
        data = _get_backend().get_config("automations")
        automations_list = data.get("list", []) if data else []
        if db_alias:
            automations_list = [a for a in automations_list if a.get("connection_alias") == db_alias or not a.get("connection_alias")]
        return automations_list
    except Exception as e:
        logger.error(f"[automations] _load_automations failed: {e}", exc_info=True)
        return []


def _save_automations(automations: list[dict]) -> None:
    try:
        _get_backend().save_config("automations", {"list": automations})
    except Exception as e:
        logger.error(f"[automations] _save_automations failed: {e}", exc_info=True)
        raise


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("")
def list_automations():
    db_alias = get_db_alias()
    data = _load_automations(db_alias)
    return {"automations": data}


@router.get("/{automation_id}")
def get_automation(automation_id: str):
    db_alias = get_db_alias()
    automations = _load_automations(db_alias)
    target = next((a for a in automations if a["id"] == automation_id), None)

    if not target:
        raise HTTPException(status_code=404, detail="Automation not found.")

    return {"automation": target}


@router.post("")
def create_automation(payload: dict = Body(...)):
    db_alias = get_db_alias()
    name = payload.get("name", "").strip()
    query = payload.get("query", "").strip()
    cron_expr = payload.get("cron_expr", "").strip()

    if not name or not query or not cron_expr:
        raise HTTPException(status_code=400, detail="name, query, and cron_expr are required.")

    automation = {
        "id": str(uuid.uuid4())[:8],
        "name": name,
        "query": query,
        "cron_expr": cron_expr,
        "connection_alias": db_alias,
        "action_type": payload.get("action_type", "log"),
        "action_config": payload.get("action_config", {}),
        "enabled": True,
        "last_run": None,
        "last_status": None,
        "run_history": [],
        "created_at": time.time(),
    }

    automations = _load_automations(db_alias)
    automations.append(automation)
    _save_automations(automations)

    from ..services.scheduler import register_job
    try:
        register_job(automation)
    except Exception as e:
        logger.warning(f"[automations] failed to register with scheduler: {e}")

    return {"status": "created", "automation": automation}


@router.put("/{automation_id}")
def update_automation(automation_id: str, payload: dict = Body(...)):
    db_alias = get_db_alias()
    automations = _load_automations(db_alias)
    target = next((a for a in automations if a["id"] == automation_id), None)

    if not target:
        raise HTTPException(status_code=404, detail="Automation not found.")

    for key in ("name", "query", "cron_expr", "action_type", "action_config", "enabled"):
        if key in payload:
            target[key] = payload[key]

    _save_automations(automations)

    from ..services.scheduler import register_job, remove_job
    remove_job(automation_id)
    if target["enabled"]:
        register_job(target)

    return {"status": "updated", "automation": target}


@router.delete("/{automation_id}")
def delete_automation(automation_id: str):
    db_alias = get_db_alias()
    automations = _load_automations(db_alias)
    updated = [a for a in automations if a["id"] != automation_id]
    if len(updated) == len(automations):
        raise HTTPException(status_code=404, detail="Automation not found.")

    _save_automations(updated)

    from ..services.scheduler import remove_job
    remove_job(automation_id)

    return {"status": "deleted"}


@router.get("/{automation_id}/runs")
def get_run_history(automation_id: str):
    """Return the persisted run history for an automation."""
    db_alias = get_db_alias()
    automations = _load_automations(db_alias)
    target = next((a for a in automations if a["id"] == automation_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Automation not found.")
    return {"runs": target.get("run_history", [])}


@router.post("/{automation_id}/run")
def trigger_automation(automation_id: str):
    db_alias = get_db_alias()
    # Load all automations (not filtered by alias) so we can save back
    all_automations = _load_automations()
    target = next((a for a in all_automations if a["id"] == automation_id), None)

    if not target:
        raise HTTPException(status_code=404, detail="Automation not found.")

    from ..services.scheduler import execute_automation_job
    start_ts = time.time()
    result = execute_automation_job(target)
    end_ts = time.time()

    # Build a persistent run record
    run_record = {
        "id": f"run-{str(uuid.uuid4())[:8]}",
        "automation_id": automation_id,
        "start_time": start_ts,
        "end_time": end_ts,
        "status": "success" if result.get("success") else "error",
        "error": result.get("error"),
        "result_rows": result.get("row_count", 0),
        "duration_ms": int((end_ts - start_ts) * 1000),
    }

    target["last_run"] = end_ts
    target["last_status"] = run_record["status"]
    # Prepend and cap at 50 entries
    history = target.get("run_history", [])
    history.insert(0, run_record)
    target["run_history"] = history[:50]

    _save_automations(all_automations)

    return {"status": "triggered", "result": result, "run": run_record}
