from fastapi import Request, HTTPException
from ...memory.store import get_active_connection, get_connections
from ...connection.core import Arivu
import logging

logger = logging.getLogger("arivu.dashboard.dependencies")

def get_cached_connection(request: Request, alias: str) -> Arivu:
    """
    Retrieves a cached connection for the given alias.
    If it doesn't exist in the process memory pool, it creates and caches it.
    """
    pool = getattr(request.app.state, "db_pool", None)
    if pool is None:
        pool = {}
        request.app.state.db_pool = pool

    if alias in pool:
        return pool[alias]

    connections = get_connections()
    config = next((c for c in connections if c.get("alias") == alias), None)
    if not config:
        raise HTTPException(status_code=404, detail=f"Connection alias '{alias}' not found.")

    try:
        connect_args = {k: v for k, v in config.items() if k != "alias"}
        if "mode" not in connect_args:
            connect_args["mode"] = "user"
        db_instance = Arivu.connect(**connect_args)
        pool[alias] = db_instance
        return db_instance
    except Exception as e:
        logger.error(f"Failed to load connection for {alias}: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to connect to {alias}: {e}")


def get_db(request: Request):
    """
    Dependency to retrieve the currently active Arivu engine instance.
    Uses the db_pool to lazy load if not already in memory.
    """
    active_alias = get_active_connection()
    if not active_alias:
        raise HTTPException(
            status_code=400, 
            detail="Database not connected. Please configure an active connection in the Connector."
        )
    return get_cached_connection(request, active_alias)


def get_db_alias() -> str:
    """
    Return the currently active database alias.
    Raises 400 if no connection is active.
    """
    alias = get_active_connection()
    if not alias:
        raise HTTPException(
            status_code=400,
            detail="Database not connected. Please configure an active connection in the Connector."
        )
    return alias
