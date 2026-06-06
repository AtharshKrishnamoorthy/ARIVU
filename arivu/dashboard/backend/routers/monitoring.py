from fastapi import APIRouter, Body, Query, Depends, Request
from typing import Optional

from ..dependencies import get_db_alias, get_db
from ....memory.store import (
    get_pipeline_traces,
    get_session_list,
    get_error_log,
    get_rlhf_log,
    load_session_history,
    get_dashboard_stats
)
from ....connection.core import Arivu

router = APIRouter(prefix="/api")

@router.get("/traces")
def api_traces(
    limit: int = Query(100, le=1000),
    session_id: Optional[str] = Query(None),
):
    db_alias = get_db_alias()
    traces = get_pipeline_traces(session_id=session_id, limit=limit, db_alias=db_alias)
    return {"traces": traces, "count": len(traces)}

@router.get("/sessions")
def api_sessions(limit: int = Query(100, le=1000)):
    db_alias = get_db_alias()
    sessions = get_session_list(limit=limit, db_alias=db_alias)
    return {"sessions": sessions, "count": len(sessions)}

@router.get("/errors")
def api_errors(limit: int = Query(100, le=1000)):
    db_alias = get_db_alias()
    errors = get_error_log(limit=limit, db_alias=db_alias)
    return {"errors": errors, "count": len(errors)}

@router.get("/rlhf")
def api_rlhf(
    limit: int = Query(100, le=1000),
    signal: Optional[str] = Query(None),
):
    db_alias = get_db_alias()
    entries = get_rlhf_log(limit=limit, signal_filter=signal, db_alias=db_alias)
    return {"rlhf": entries, "count": len(entries)}

@router.get("/session/{session_id}")
def api_session_detail(session_id: str):
    db_alias = get_db_alias()
    history  = load_session_history(session_id, limit=200, db_alias=db_alias)
    traces   = get_pipeline_traces(session_id=session_id, limit=200, db_alias=db_alias)
    errors   = [e for e in get_error_log(limit=500, db_alias=db_alias) if e["session_id"] == session_id]
    rlhf     = [r for r in get_rlhf_log(limit=500, db_alias=db_alias) if r["session_id"] == session_id]
    return {
        "session_id": session_id,
        "history":    history,
        "traces":     traces,
        "errors":     errors,
        "rlhf":       rlhf,
    }

@router.get("/session/{session_id}/health")
def api_session_health(session_id: str, request: Request, db: Arivu = Depends(get_db)):
    """
    Ping endpoint to verify if the DB connection for the active alias is healthy.
    If it gets here without throwing an HTTPException from Depends(get_db), 
    the instance is theoretically available. We can do a quick check.
    """
    try:
        # A quick lightweight query to ensure the connection is active
        # Many DB adapters support a raw SQL execution. For safety, just checking db object.
        if hasattr(db, "engine"):
            with db.engine.connect() as conn:
                pass
        return {"session_id": session_id, "connection": "ok", "status": "active"}
    except Exception as e:
        return {"session_id": session_id, "connection": "error", "error": str(e), "status": "inactive"}

@router.post("/rlhf")
def api_save_rlhf(payload: dict = Body(...)):
    from ....memory.store import save_rlhf_signal
    db_alias = get_db_alias()
    save_rlhf_signal(
        session_id = payload.get("session_id", ""),
        question   = payload.get("question", ""),
        sql        = payload.get("sql", ""),
        signal     = payload.get("signal", "positive"),
        approved   = None,
        db_alias   = db_alias,
        dialect    = payload.get("dialect", ""),
        interface  = payload.get("interface", "dashboard"),
    )
    return {"status": "success"}

@router.get("/stats")
def api_stats():
    db_alias = get_db_alias()
    return get_dashboard_stats(db_alias=db_alias)


@router.get("/config")
def api_config():
    return {
        "limits": {
            "max_query_chars": 10_000,
            "max_result_rows": 10_000,
            "max_retries": 3,
        }
    }
