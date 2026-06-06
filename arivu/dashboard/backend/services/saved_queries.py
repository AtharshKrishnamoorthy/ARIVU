"""
arivu.dashboard.backend.services.saved_queries
─────────────────────────────────────────────────
Business logic for saved queries management.
"""

import logging
import uuid
from typing import Optional

from ....memory.store import _get_backend

logger = logging.getLogger("arivu.dashboard.saved_queries")


def create_saved_query(
    session_id: str,
    query: str,
    sql: str,
    notes: str = "",
    db_alias: str = "",
) -> dict:
    query_id = str(uuid.uuid4())
    try:
        _get_backend().save_saved_query(
            query_id=query_id,
            session_id=session_id,
            query=query,
            sql=sql,
            notes=notes,
            db_alias=db_alias,
        )
        logger.info(f"[saved_queries] Created query {query_id} from session {session_id}  db={db_alias}")
        return {
            "id": query_id,
            "session_id": session_id,
            "query": query,
            "sql": sql,
            "notes": notes,
        }
    except Exception as e:
        logger.error(f"[saved_queries] Failed to create query: {e}", exc_info=True)
        raise


def get_saved_query(query_id: str, db_alias: str = "") -> Optional[dict]:
    try:
        result = _get_backend().get_saved_query(query_id, db_alias=db_alias)
        if result:
            logger.info(f"[saved_queries] Retrieved query {query_id}")
        else:
            logger.warning(f"[saved_queries] Query {query_id} not found")
        return result
    except Exception as e:
        logger.error(f"[saved_queries] Failed to fetch query {query_id}: {e}", exc_info=True)
        raise


def list_saved_queries(limit: int = 50, offset: int = 0, db_alias: str = "") -> list[dict]:
    try:
        result = _get_backend().list_saved_queries(limit=limit, offset=offset, db_alias=db_alias)
        logger.info(f"[saved_queries] Listed {len(result)} queries  db={db_alias}")
        return result
    except Exception as e:
        logger.error(f"[saved_queries] Failed to list queries: {e}", exc_info=True)
        raise


def list_session_saved_queries(session_id: str, limit: int = 50, db_alias: str = "") -> list[dict]:
    try:
        result = _get_backend().list_session_saved_queries(session_id=session_id, limit=limit, db_alias=db_alias)
        logger.info(f"[saved_queries] Listed {len(result)} queries for session {session_id}  db={db_alias}")
        return result
    except Exception as e:
        logger.error(
            f"[saved_queries] Failed to list queries for session {session_id}: {e}",
            exc_info=True
        )
        raise


def update_saved_query_notes(query_id: str, notes: str, db_alias: str = "") -> dict:
    try:
        _get_backend().update_saved_query(query_id=query_id, notes=notes, db_alias=db_alias)
        logger.info(f"[saved_queries] Updated notes for query {query_id}")
        result = _get_backend().get_saved_query(query_id, db_alias=db_alias)
        if result:
            return result
        raise ValueError(f"Query {query_id} not found after update")
    except Exception as e:
        logger.error(f"[saved_queries] Failed to update query {query_id}: {e}", exc_info=True)
        raise


def delete_saved_query(query_id: str, db_alias: str = "") -> dict:
    try:
        query = _get_backend().get_saved_query(query_id, db_alias=db_alias)
        if not query:
            raise ValueError(f"Query {query_id} not found")

        _get_backend().delete_saved_query(query_id=query_id, db_alias=db_alias)
        logger.info(f"[saved_queries] Deleted query {query_id}")
        return {"status": "success", "query_id": query_id}
    except Exception as e:
        logger.error(f"[saved_queries] Failed to delete query {query_id}: {e}", exc_info=True)
        raise
