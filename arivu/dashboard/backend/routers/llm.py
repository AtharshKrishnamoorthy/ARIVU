import logging
from fastapi import APIRouter, Body

from ....memory.store import get_llm_config, save_llm_config
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
    save_llm_config(config)
    get_llm.cache_clear()
    logger.info(f"Saved new LLM config. Cache cleared. provider={config.get('provider')}")
    return {"status": "success"}
