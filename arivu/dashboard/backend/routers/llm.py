import logging
import uuid
from fastapi import APIRouter, Body

from ....memory.store import (
    get_llm_config, save_llm_config,
    list_llm_entries, save_llm_entry, activate_llm_entry, delete_llm_entry,
)
from ....llm.providers import list_providers, get_llm

logger = logging.getLogger("arivu.dashboard.server.llm")

router = APIRouter(prefix="/api/llm")

@router.get("")
def api_get_llm():
    config = get_llm_config()
    return {
        "config": config or {},
        "providers": list_providers()
    }

@router.post("")
def api_save_llm(config: dict = Body(...)):
    """Save and activate an LLM config (backward compat — also adds to store)."""
    entry_id = str(uuid.uuid4())
    entry = {
        **config,
        "name": config.get("name", f"{config.get('provider', 'llm').capitalize()} Config"),
        "created_at": __import__("time").time(),
    }
    save_llm_entry(entry_id, entry)
    activate_llm_entry(entry_id)
    get_llm(refresh=True)
    logger.info(f"Saved new LLM config. Provider refreshed. provider={config.get('provider')}")
    return {"status": "success", "id": entry_id}


# ── LLM Store endpoints ──────────────────────────────────────────────────────

@router.get("/store")
def api_list_llm_store():
    """List all stored LLM configurations."""
    entries = list_llm_entries()
    return {"entries": entries}

@router.post("/store")
def api_add_llm_entry(config: dict = Body(...)):
    """Add a new LLM config to the store and activate it."""
    entry_id = str(uuid.uuid4())
    entry = {
        **config,
        "name": config.get("name", f"{config.get('provider', 'llm').capitalize()} Config"),
        "created_at": __import__("time").time(),
    }
    save_llm_entry(entry_id, entry)
    activate_llm_entry(entry_id)
    get_llm(refresh=True)
    logger.info(f"Added LLM entry {entry_id} and activated. provider={config.get('provider')}")
    return {"status": "success", "id": entry_id}

@router.post("/store/{entry_id}/activate")
def api_activate_llm(entry_id: str):
    """Activate a stored LLM configuration."""
    activate_llm_entry(entry_id)
    get_llm(refresh=True)
    logger.info(f"Activated LLM entry {entry_id}")
    return {"status": "success"}

@router.delete("/store/{entry_id}")
def api_delete_llm(entry_id: str):
    """Remove an LLM configuration from the store."""
    delete_llm_entry(entry_id)
    logger.info(f"Deleted LLM entry {entry_id}")
    return {"status": "success"}
