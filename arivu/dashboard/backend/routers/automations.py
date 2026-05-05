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

from ....memory.store import _get_backend

logger = logging.getLogger("arivu.dashboard.automations")

router = APIRouter(prefix="/api/automations")


# ─────────────────────────────────────────────────────────────────────────────
# Helpers: read/write automations list via the existing config KV store
# ─────────────────────────────────────────────────────────────────────────────

def _load_automations() -> list[dict]:
    try:
        data = _get_backend().get_config("automations")
        automations_list = data.get("list", []) if data else []
        logger.info(f"[automations] _load_automations: found {len(automations_list)} automations")
        for auto in automations_list:
            logger.info(f"  - {auto.get('id')}: {auto.get('name')}")
        return automations_list
    except Exception as e:
        logger.error(f"[automations] _load_automations failed: {e}", exc_info=True)
        return []


def _save_automations(automations: list[dict]) -> None:
    try:
        logger.info(f"[automations] _save_automations: saving {len(automations)} automations")
        for auto in automations:
            logger.info(f"  - {auto.get('id')}: {auto.get('name')}")
        _get_backend().save_config("automations", {"list": automations})
        logger.info("[automations] _save_automations: saved successfully")
    except Exception as e:
        logger.error(f"[automations] _save_automations failed: {e}", exc_info=True)
        raise


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("")
def list_automations():
    """Return all automations."""
    data = _load_automations()
    logger.info(f"[automations] list_automations returning {len(data)} items")
    return {"automations": data}


@router.get("/{automation_id}")
def get_automation(automation_id: str):
    """Get a single automation by ID."""
    logger.info(f"[automations] >>> GET /{automation_id} called")
    automations = _load_automations()
    logger.info(f"[automations] get_automation id={automation_id}, searching in {len(automations)} automations")
    logger.info(f"[automations] available IDs: {[a['id'] for a in automations]}")
    
    target = next((a for a in automations if a["id"] == automation_id), None)
    
    if not target:
        logger.warning(f"[automations] ❌ id={automation_id} NOT FOUND")
        raise HTTPException(status_code=404, detail="Automation not found.")
    
    logger.info(f"[automations] ✓ found automation: {target['name']}")
    return {"automation": target}


@router.post("")
def create_automation(payload: dict = Body(...)):
    """
    Create a new automation.

    Expected body:
        {
            "name":        "Weekly Sales Report",
            "query":       "Show me total sales by region for the last 7 days",
            "cron_expr":   "0 9 * * 1",           // every Monday at 09:00
            "action_type": "log",                  // "log" | "email" | "webhook"
            "action_config": {}                    // e.g. {"to": "a@b.com"} for email
        }
    """
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
        "action_type": payload.get("action_type", "log"),
        "action_config": payload.get("action_config", {}),
        "enabled": True,
        "last_run": None,
        "last_status": None,
        "created_at": time.time(),
    }

    logger.info(f"[automations] create_automation: {automation['id']} — {name}")

    automations = _load_automations()
    logger.info(f"[automations] before append: {len(automations)} automations exist")
    
    automations.append(automation)
    
    logger.info(f"[automations] after append: {len(automations)} automations, saving...")
    _save_automations(automations)
    
    logger.info(f"[automations] created successfully: {automation['id']}")

    # Register with the live scheduler if available
    from ..services.scheduler import register_job
    try:
        register_job(automation)
        logger.info(f"[automations] registered with scheduler: {automation['id']}")
    except Exception as e:
        logger.warning(f"[automations] failed to register with scheduler: {e}")

    return {"status": "created", "automation": automation}


@router.put("/{automation_id}")
def update_automation(automation_id: str, payload: dict = Body(...)):
    """Update an existing automation's fields."""
    automations = _load_automations()
    target = next((a for a in automations if a["id"] == automation_id), None)

    if not target:
        raise HTTPException(status_code=404, detail="Automation not found.")

    # Merge allowed fields
    for key in ("name", "query", "cron_expr", "action_type", "action_config", "enabled"):
        if key in payload:
            target[key] = payload[key]

    _save_automations(automations)

    # Re-register with scheduler
    from ..services.scheduler import register_job, remove_job
    remove_job(automation_id)
    if target["enabled"]:
        register_job(target)

    return {"status": "updated", "automation": target}


@router.delete("/{automation_id}")
def delete_automation(automation_id: str):
    """Delete an automation by ID."""
    automations = _load_automations()
    updated = [a for a in automations if a["id"] != automation_id]
    if len(updated) == len(automations):
        raise HTTPException(status_code=404, detail="Automation not found.")

    _save_automations(updated)

    from ..services.scheduler import remove_job
    remove_job(automation_id)

    return {"status": "deleted"}


@router.post("/{automation_id}/run")
def trigger_automation(automation_id: str):
    """Manually trigger an automation right now (bypass cron schedule)."""
    automations = _load_automations()
    target = next((a for a in automations if a["id"] == automation_id), None)

    if not target:
        raise HTTPException(status_code=404, detail="Automation not found.")

    from ..services.scheduler import execute_automation_job
    result = execute_automation_job(target)

    # Update last_run metadata
    target["last_run"] = time.time()
    target["last_status"] = "success" if result.get("success") else "error"
    _save_automations(automations)

    return {"status": "triggered", "result": result}
