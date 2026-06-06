import asyncio
import json
import os
import queue
from collections.abc import AsyncGenerator
from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from cachetools import TTLCache

from ..dependencies import get_db, get_db_alias
from ....connection.core import Arivu

router = APIRouter(prefix="/api/chat")

_QUERY_CACHE = TTLCache(maxsize=1000, ttl=300)

DEFAULT_MAX_QUERY_CHARS = 10_000
DEFAULT_MAX_RESULT_ROWS = 10_000
DEFAULT_MAX_RETRIES = 3

_RATE_LIMIT = os.environ.get("ARIVU_CHAT_RATE_LIMIT", "30/minute")

try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    _limiter = Limiter(key_func=get_remote_address)
    _rate_limited = _limiter.limit(_RATE_LIMIT)
except ImportError:
    _rate_limited = lambda fn: fn  # no-op if slowapi not installed


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _run_pipeline(
    message: str,
    session_id: str,
    interface: str,
    db_alias: str,
    db: Arivu,
    cfg,
    q: queue.Queue,
) -> None:
    from ....pipeline.runner import run_pipeline

    def progress_cb(text: str, **kwargs) -> None:
        q.put({"type": "progress", "text": text})

    pipeline_input = db.query(message)
    pipeline_input["session_id"] = session_id
    pipeline_input["interface"] = interface
    pipeline_input["db_alias"] = db_alias
    result = run_pipeline(pipeline_input, config=cfg, progress_callback=progress_cb)

    raw = result.raw_result or []
    has_tabular = bool(raw and len(raw) > 0 and isinstance(raw[0], dict))

    response_data = {
        "response": result.response,
        "sql": result.sql,
        "error": result.error,
        "raw_result": raw if has_tabular else None,
        "has_tabular_data": has_tabular,
        "results_truncated": result.results_truncated,
        "limits": {
            "max_query_chars": cfg.max_query_chars,
            "max_result_rows": cfg.max_result_rows,
            "max_retries": cfg.max_retries,
        },
    }

    if not result.error:
        cache_key = f"{session_id}:{message}"
        _QUERY_CACHE[cache_key] = response_data

    q.put({"type": "done", "data": response_data})


async def _event_generator(
    message: str,
    session_id: str,
    interface: str,
    db_alias: str,
    db: Arivu,
    cfg,
) -> AsyncGenerator[str, None]:
    q: queue.Queue = queue.Queue()

    loop = asyncio.get_event_loop()
    task = loop.run_in_executor(None, _run_pipeline, message, session_id, interface, db_alias, db, cfg, q)

    try:
        while True:
            msg = await loop.run_in_executor(None, q.get)
            if msg["type"] == "progress":
                yield _sse("progress", {"text": msg["text"]})
            elif msg["type"] == "done":
                yield _sse("done", msg["data"])
                break
    except asyncio.CancelledError:
        task.cancel()
        yield _sse("error", {"text": "Stream cancelled"})
        raise


@router.post("/stream")
@_rate_limited
async def api_chat_stream(request: Request, req: dict = Body(...), db: Arivu = Depends(get_db)):
    message = req.get("message", "").strip()
    session_id = req.get("session_id", "default")
    interface = req.get("interface", "dashboard")
    max_query_chars = req.get("max_query_chars", DEFAULT_MAX_QUERY_CHARS)
    max_result_rows = req.get("max_result_rows", DEFAULT_MAX_RESULT_ROWS)

    cache_key = f"{session_id}:{message}"
    if cache_key in _QUERY_CACHE:
        cached = _QUERY_CACHE[cache_key]
        async def _cached_stream():
            yield _sse("done", {**cached, "_cached": True})
        return StreamingResponse(_cached_stream(), media_type="text/event-stream")

    from ....pipeline.runner import PipelineConfig

    cfg = PipelineConfig(
        max_query_chars=max_query_chars if max_query_chars > 0 else DEFAULT_MAX_QUERY_CHARS,
        max_result_rows=max_result_rows if max_result_rows > 0 else DEFAULT_MAX_RESULT_ROWS,
        max_retries=DEFAULT_MAX_RETRIES,
    )

    db_alias = get_db_alias()

    return StreamingResponse(
        _event_generator(message, session_id, interface, db_alias, db, cfg),
        media_type="text/event-stream",
    )


@router.post("")
@_rate_limited
async def api_chat(request: Request, req: dict = Body(...), db: Arivu = Depends(get_db)):
    message = req.get("message", "").strip()
    session_id = req.get("session_id", "default")
    interface = req.get("interface", "dashboard")
    max_query_chars = req.get("max_query_chars", DEFAULT_MAX_QUERY_CHARS)
    max_result_rows = req.get("max_result_rows", DEFAULT_MAX_RESULT_ROWS)

    cache_key = f"{session_id}:{message}"
    if cache_key in _QUERY_CACHE:
        cached_result = _QUERY_CACHE[cache_key]
        return {**cached_result, "_cached": True}

    from ....pipeline.runner import run_pipeline, PipelineConfig

    cfg = PipelineConfig(
        max_query_chars=max_query_chars if max_query_chars > 0 else DEFAULT_MAX_QUERY_CHARS,
        max_result_rows=max_result_rows if max_result_rows > 0 else DEFAULT_MAX_RESULT_ROWS,
        max_retries=DEFAULT_MAX_RETRIES,
    )

    db_alias = get_db_alias()

    def _run():
        pipeline_input = db.query(message)
        pipeline_input["session_id"] = session_id
        pipeline_input["interface"] = interface
        pipeline_input["db_alias"] = db_alias
        return run_pipeline(pipeline_input, config=cfg)

    result = await asyncio.to_thread(_run)

    raw = result.raw_result or []
    has_tabular = bool(raw and len(raw) > 0 and isinstance(raw[0], dict))

    response_data = {
        "response": result.response,
        "sql": result.sql,
        "error": result.error,
        "raw_result": raw if has_tabular else None,
        "has_tabular_data": has_tabular,
        "results_truncated": result.results_truncated,
        "limits": {
            "max_query_chars": cfg.max_query_chars,
            "max_result_rows": cfg.max_result_rows,
            "max_retries": cfg.max_retries,
        },
    }

    if not result.error:
        _QUERY_CACHE[cache_key] = response_data

    return response_data


@router.get("/config")
def api_chat_config():
    return {
        "limits": {
            "max_query_chars": DEFAULT_MAX_QUERY_CHARS,
            "max_result_rows": DEFAULT_MAX_RESULT_ROWS,
            "max_retries": DEFAULT_MAX_RETRIES,
        }
    }
