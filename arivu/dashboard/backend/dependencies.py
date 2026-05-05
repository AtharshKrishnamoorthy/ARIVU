from fastapi import Request, HTTPException
from ...memory.store import get_active_connection, get_connections
from ...connection.core import Arivu
import logging

logger = logging.getLogger("arivu.dashboard.dependencies")

def get_db(request: Request):
    """
    Dependency to retrieve the active Arivu engine instance.
    Lazily loads the connection on the first actual request if missing.
    """
    db_instance = getattr(request.app.state, "arivu_db", None)
    
    if not db_instance:
        # We NO LONGER perform explicit lazy load on first query from active_alias.
        # This ensures the user must explicitly select a connection in the UI.
        pass
                    
    if not db_instance:
        raise HTTPException(
            status_code=400, 
            detail="Database not connected. Please configure an active connection in the Connector."
        )
    return db_instance
