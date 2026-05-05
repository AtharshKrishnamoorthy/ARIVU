import logging
from fastapi import APIRouter, Body, HTTPException, Request

from ....memory.store import (
    get_connections,
    save_connections,
    get_active_connection,
    set_active_connection
)
from ....connection.core import Arivu

logger = logging.getLogger("arivu.dashboard.server.connections")

router = APIRouter(prefix="/api/connections")

@router.get("")
def api_get_connections():
    connections = get_connections()
    active = get_active_connection()
    return {
        "connections": connections,
        "active_alias": active
    }

@router.delete("/{alias}")
def api_delete_connection(alias: str):
    connections = get_connections()
    updated = [c for c in connections if c.get("alias") != alias]
    if len(updated) == len(connections):
        raise HTTPException(status_code=404, detail="Connection alias not found")
    save_connections(updated)
    return {"status": "success"}

@router.post("")
def api_save_connections(config: dict = Body(...)):
    connections = get_connections()
    alias = config.get("alias")
    if not alias:
        raise HTTPException(status_code=400, detail="Alias is required")
        
    updated = False
    for i, c in enumerate(connections):
        if c.get("alias") == alias:
            connections[i] = config
            updated = True
            break
    if not updated:
        connections.append(config)
        
    save_connections(connections)
    return {"status": "success"}

@router.post("/test")
def api_test_connection(config: dict = Body(...)):
    try:
        connect_args = {k: v for k, v in config.items() if k != "alias"}
        test_db = Arivu.connect(**connect_args)
        test_db.close()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/active")
def api_set_active_connection(request: Request, payload: dict = Body(...)):
    alias = payload.get("alias")
    connections = get_connections()
    config = next((c for c in connections if c.get("alias") == alias), None)
    
    if not config:
        raise HTTPException(status_code=404, detail="Connection alias not found")
        
    try:
        connect_args = {k: v for k, v in config.items() if k != "alias"}
        new_db = Arivu.connect(**connect_args)
        request.app.state.arivu_db = new_db
        set_active_connection(alias)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
