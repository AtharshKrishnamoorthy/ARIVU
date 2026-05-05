import asyncio
from fastapi import APIRouter, Body, Depends, HTTPException
from cachetools import TTLCache

from ..dependencies import get_db
from ....connection.core import Arivu

router = APIRouter(prefix="/api/chat")

# 5-minute cache for identical queries
_query_cache = TTLCache(maxsize=1000, ttl=300)

@router.post("")
async def api_chat(req: dict = Body(...), db: Arivu = Depends(get_db)):
    message = req.get("message", "").strip()
    session_id = req.get("session_id", "default")
    interface = req.get("interface", "dashboard")

    # Check semantic cache
    cache_key = f"{session_id}:{message}"
    if cache_key in _query_cache:
        cached_result = _query_cache[cache_key]
        return {**cached_result, "_cached": True}

    def _run():
        from ....pipeline.runner import run_pipeline
        pipeline_input = db.query(message)
        pipeline_input["session_id"] = session_id
        pipeline_input["interface"] = interface
        return run_pipeline(pipeline_input)
        
    result = await asyncio.to_thread(_run)

    # Determine if the result contains tabular data suitable for visualization
    raw = result.raw_result or []
    has_tabular = bool(raw and len(raw) > 0 and isinstance(raw[0], dict))

    response_data = {
        "response": result.response,
        "sql": result.sql,
        "error": result.error,
        "raw_result": raw if has_tabular else None,
        "has_tabular_data": has_tabular,
    }

    # Save to cache if no error
    if not result.error:
        _query_cache[cache_key] = response_data

    return response_data
