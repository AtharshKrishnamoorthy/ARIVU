"""
arivu.dashboard.backend.routers.saved_queries
──────────────────────────────────────────────
REST API endpoints for saved queries CRUD.
"""

import logging
from fastapi import APIRouter, HTTPException, Body, Query

from ..dependencies import get_db_alias
from ..services import saved_queries

logger = logging.getLogger("arivu.dashboard.routers.saved_queries")

router = APIRouter(prefix="/api/saved-queries", tags=["saved-queries"])


@router.post("")
def api_create_saved_query(
    payload: dict = Body(...)
):
    try:
        session_id = payload.get("session_id")
        query_text = payload.get("query")
        sql_text = payload.get("sql")
        notes = payload.get("notes", "")

        if not all([session_id, query_text, sql_text]):
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: session_id, query, sql"
            )

        db_alias = get_db_alias()
        result = saved_queries.create_saved_query(
            session_id=session_id,
            query=query_text,
            sql=sql_text,
            notes=notes,
            db_alias=db_alias,
        )
        return {"status": "success", "data": result}
    except Exception as e:
        logger.error(f"[saved_queries] POST / failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
def api_list_saved_queries(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    try:
        db_alias = get_db_alias()
        result = saved_queries.list_saved_queries(limit=limit, offset=offset, db_alias=db_alias)
        return {"status": "success", "data": result}
    except Exception as e:
        logger.error(f"[saved_queries] GET / failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{query_id}")
def api_get_saved_query(query_id: str):
    try:
        db_alias = get_db_alias()
        result = saved_queries.get_saved_query(query_id, db_alias=db_alias)
        if not result:
            raise HTTPException(status_code=404, detail=f"Query {query_id} not found")
        return {"status": "success", "data": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[saved_queries] GET /{query_id} failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/queries")
def api_list_session_queries(
    session_id: str,
    limit: int = Query(50, ge=1, le=200),
):
    try:
        db_alias = get_db_alias()
        result = saved_queries.list_session_saved_queries(session_id=session_id, limit=limit, db_alias=db_alias)
        return {"status": "success", "data": result}
    except Exception as e:
        logger.error(
            f"[saved_queries] GET /sessions/{session_id}/queries failed: {e}",
            exc_info=True
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{query_id}")
def api_update_saved_query(
    query_id: str,
    payload: dict = Body(...),
):
    try:
        notes = payload.get("notes", "")
        db_alias = get_db_alias()
        result = saved_queries.update_saved_query_notes(query_id=query_id, notes=notes, db_alias=db_alias)
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"[saved_queries] PUT /{query_id} failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{query_id}")
def api_delete_saved_query(query_id: str):
    try:
        db_alias = get_db_alias()
        result = saved_queries.delete_saved_query(query_id=query_id, db_alias=db_alias)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"[saved_queries] DELETE /{query_id} failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
