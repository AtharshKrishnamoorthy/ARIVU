"""
arivu.dashboard.backend.routers.dashboards
──────────────────────────────────────────
CRUD endpoints for Saved Dashboards.
Dashboards and their widgets are saved in SQLite tables.
"""

import json
import logging
import sqlite3
import time
import uuid

from fastapi import APIRouter, Body, HTTPException
from ....memory.store import _get_backend

logger = logging.getLogger("arivu.dashboard.dashboards")

router = APIRouter(prefix="/api/dashboards")

def _run_sql(query, params=(), fetch=False):
    backend = _get_backend()
    # If the backend has a direct _conn context manager (like SQLiteMemoryBackend), use it
    if hasattr(backend, "_conn"):
        with backend._conn() as conn:
            cur = conn.execute(query, params)
            if fetch:
                return [dict(row) for row in cur.fetchall()]
            return cur.lastrowid
    
    # Fallback for plain sqlite3 connecting
    db_path = getattr(backend, "db_path", "arivu.db")
    with sqlite3.connect(db_path, timeout=15.0) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(query, params)
        if fetch:
            return [dict(row) for row in cur.fetchall()]
        conn.commit()
        return cur.lastrowid

# ─────────────────────────────────────────────────────────────────────────────
# Dashboards
# ─────────────────────────────────────────────────────────────────────────────

@router.get("")
def list_dashboards():
    rows = _run_sql("SELECT * FROM dashboards ORDER BY created_at DESC", fetch=True)
    return {"dashboards": rows}

@router.post("")
def create_dashboard(payload: dict = Body(...)):
    name = payload.get("name", "New Dashboard")
    d_id = str(uuid.uuid4())[:8]
    _run_sql(
        "INSERT INTO dashboards (id, name, layout, created_at) VALUES (?, ?, ?, ?)",
        (d_id, name, "[]", time.time())
    )
    return {"status": "created", "id": d_id}

@router.get("/{dashboard_id}")
def get_dashboard(dashboard_id: str):
    rows = _run_sql("SELECT * FROM dashboards WHERE id = ?", (dashboard_id,), fetch=True)
    if not rows:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    widgets = _run_sql("SELECT * FROM dashboard_widgets WHERE dashboard_id = ?", (dashboard_id,), fetch=True)
    for w in widgets:
        w["data"] = json.loads(w["data_json"])
        w["position"] = json.loads(w["position"]) if w["position"] else None
        
    dashboard = rows[0]
    dashboard["layout"] = json.loads(dashboard["layout"]) if dashboard["layout"] else []
    
    return {"dashboard": dashboard, "widgets": widgets}

@router.put("/{dashboard_id}/layout")
def update_dashboard_layout(dashboard_id: str, payload: dict = Body(...)):
    layout = json.dumps(payload.get("layout", []))
    _run_sql("UPDATE dashboards SET layout = ? WHERE id = ?", (layout, dashboard_id))
    return {"status": "success"}

@router.delete("/{dashboard_id}")
def delete_dashboard(dashboard_id: str):
    _run_sql("DELETE FROM dashboards WHERE id = ?", (dashboard_id,))
    return {"status": "success"}

# ─────────────────────────────────────────────────────────────────────────────
# Widgets
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{dashboard_id}/widgets")
def add_widget(dashboard_id: str, payload: dict = Body(...)):
    """Pin a new widget to a dashboard."""
    title = payload.get("title", "Widget")
    query = payload.get("query", "")
    sql = payload.get("sql", "")
    data = payload.get("data", [])
    c1_html = payload.get("c1_html", "")
    position = payload.get("position", {})
    
    w_id = str(uuid.uuid4())[:8]
    _run_sql(
        """INSERT INTO dashboard_widgets 
           (id, dashboard_id, title, query, sql, data_json, c1_html, position, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (w_id, dashboard_id, title, query, sql, json.dumps(data), c1_html, json.dumps(position), time.time())
    )
    return {"status": "success", "id": w_id}

@router.delete("/{dashboard_id}/widgets/{widget_id}")
def delete_widget(dashboard_id: str, widget_id: str):
    _run_sql("DELETE FROM dashboard_widgets WHERE id = ?", (widget_id,))
    return {"status": "success"}

@router.post("/{dashboard_id}/widgets/{widget_id}/refresh")
def refresh_widget(dashboard_id: str, widget_id: str):
    """Re-runs the pipeline for this widget and re-generates the Thesys C1 chart."""
    rows = _run_sql("SELECT * FROM dashboard_widgets WHERE id = ?", (widget_id,), fetch=True)
    if not rows:
        raise HTTPException(status_code=404, detail="Widget not found")
        
    widget = rows[0]
    query = widget["query"]
    
    try:
        from ....memory.store import get_active_connection, get_connections
        from ....connection.core import Arivu
        from ....pipeline.runner import run_pipeline

        active_alias = get_active_connection()
        connections = get_connections()
        conn_config = next((c for c in connections if c.get("alias") == active_alias), None)
        if not conn_config:
            raise Exception("No active connection")

        connect_args = {k: v for k, v in conn_config.items() if k != "alias"}
        db = Arivu.connect(**connect_args)

        pipeline_input = db.query(query)
        pipeline_input["session_id"] = f"dashboard-refresh-{dashboard_id}"
        pipeline_input["interface"] = "dashboard"
        result = run_pipeline(pipeline_input)
        
        if not result.success:
            raise Exception(result.error)

        raw_data = result.raw_result or []
        
        # Now re-generate C1 visualization
        import httpx
        # We can call our own visualize proxy internally to reuse logic
        import os
        port = os.environ.get("PORT", "8000")
        
        # Because we're in the same process, we can just call the router method directly!
        from .visualize import api_visualize
        import asyncio
        
        c1_req = {
            "question": query,
            "sql": result.sql,
            "data": raw_data,
            "theme": "dark" # We default to dark for refresh
        }
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        c1_resp = loop.run_until_complete(api_visualize(c1_req))
        c1_html = c1_resp.get("c1_response", "")

        _run_sql(
            "UPDATE dashboard_widgets SET sql = ?, data_json = ?, c1_html = ? WHERE id = ?",
            (result.sql, json.dumps(raw_data), c1_html, widget_id)
        )
        return {"status": "success"}

    except Exception as exc:
        logger.error(f"[dashboards] refresh failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
