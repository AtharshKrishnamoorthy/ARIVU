from fastapi import APIRouter, Body, Query
from typing import Optional

from ....memory.store import (
    get_pipeline_traces,
    get_session_list,
    get_error_log,
    get_rlhf_log,
    load_session_history,
    get_dashboard_stats
)

router = APIRouter(prefix="/api")

@router.get("/traces")
def api_traces(
    limit: int = Query(100, le=1000),
    session_id: Optional[str] = Query(None),
):
    traces = get_pipeline_traces(session_id=session_id, limit=limit)
    return {"traces": traces, "count": len(traces)}

@router.get("/sessions")
def api_sessions(limit: int = Query(100, le=1000)):
    sessions = get_session_list(limit=limit)
    return {"sessions": sessions, "count": len(sessions)}

@router.get("/errors")
def api_errors(limit: int = Query(100, le=1000)):
    errors = get_error_log(limit=limit)
    return {"errors": errors, "count": len(errors)}

@router.get("/rlhf")
def api_rlhf(
    limit: int = Query(100, le=1000),
    signal: Optional[str] = Query(None),
):
    entries = get_rlhf_log(limit=limit, signal_filter=signal)
    return {"rlhf": entries, "count": len(entries)}

@router.get("/session/{session_id}")
def api_session_detail(session_id: str):
    from ....memory.store import load_session_history as _load
    history  = _load(session_id, limit=200)          # load full history
    traces   = get_pipeline_traces(session_id=session_id, limit=200)
    errors   = [e for e in get_error_log(limit=500) if e["session_id"] == session_id]
    rlhf     = [r for r in get_rlhf_log(limit=500) if r["session_id"] == session_id]
    return {
        "session_id": session_id,
        "history":    history,
        "traces":     traces,
        "errors":     errors,
        "rlhf":       rlhf,
    }

@router.post("/rlhf")
def api_save_rlhf(payload: dict = Body(...)):
    from ....memory.store import save_rlhf_signal
    save_rlhf_signal(
        session_id = payload.get("session_id", ""),
        question   = payload.get("question", ""),
        sql        = payload.get("sql", ""),
        signal     = payload.get("signal", "positive"),
        approved   = None,
        dialect    = payload.get("dialect", ""),
        interface  = payload.get("interface", "dashboard"),
    )
    return {"status": "success"}

@router.get("/stats")
def api_stats():
    return get_dashboard_stats()
