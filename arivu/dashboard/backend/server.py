"""
arivu.dashboard.server
─────────────────────────────
FastAPI backend for the Arivu tracing dashboard.

Serves all four dashboard panels from the memory layer:
    GET /api/traces           — pipeline trace events
    GET /api/sessions         — session list + stats
    GET /api/errors           — error boundary log
    GET /api/rlhf             — RLHF feedback log
    GET /api/stats            — aggregate metrics for the header row
    GET /api/session/{sid}    — full detail for one session
    WS  /ws/live              — live event stream via WebSocket

Usage:
    from ARIVU.dashboard.server import create_dashboard_app
    import uvicorn

    app = create_dashboard_app()
    uvicorn.run(app, host="0.0.0.0", port=9000)

Or via the CLI helper:
    python -m ARIVU.dashboard
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import defaultdict
from typing import Optional

logger = logging.getLogger("arivu.dashboard.server")

# Global Arivu connection engine instance for the dashboard execution environment
global_db = None

def create_dashboard_app():
    try:
        from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, Request, Body
        from fastapi.middleware.cors import CORSMiddleware
        from fastapi.staticfiles import StaticFiles
        from fastapi.responses import FileResponse
    except ImportError:
        raise ImportError(
            "fastapi and uvicorn are required for the dashboard. "
            "Install with: pip install fastapi uvicorn"
        )

    from ...memory.store import (
        get_pipeline_traces,
        get_session_list,
        get_error_log,
        get_rlhf_log,
        load_session_history,
        get_connections,
        save_connections,
        get_active_connection,
        set_active_connection,
        get_llm_config,
        save_llm_config

    )
    from ...connection.core import Arivu
    import asyncio
    import threading

    app = FastAPI(title="Arivu Dashboard", version="0.1.0")

    def _init_global_state():
        global global_db
        active_alias = get_active_connection()
        connections = get_connections()
        
        if active_alias and connections:
            conn_config = next((c for c in connections if c.get("alias") == active_alias), None)
            if conn_config:
                try:
                    connect_args = {k: v for k, v in conn_config.items() if k != "alias"}
                    global_db = Arivu.connect(**connect_args)
                    logger.info(f"Initialized global Arivu instance from DB config alias: {active_alias}")
                except Exception as e:
                    logger.error(f"Failed to initialize global Arivu instance: {e}")

    _init_global_state()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── WebSocket connection manager ──────────────────────────────────────
    class ConnectionManager:
        def __init__(self):
            self.active: list[WebSocket] = []

        async def connect(self, ws: WebSocket):
            await ws.accept()
            self.active.append(ws)

        def disconnect(self, ws: WebSocket):
            self.active.remove(ws)

        async def broadcast(self, data: dict):
            dead = []
            for ws in self.active:
                try:
                    await ws.send_json(data)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.active.remove(ws)

    manager = ConnectionManager()

    # ── API routes ────────────────────────────────────────────────────────

    @app.get("/api/traces")
    def api_traces(
        session_id: Optional[str] = Query(None),
        limit: int = Query(50, le=500),
    ):
        traces = get_pipeline_traces(session_id=session_id, limit=limit)
        return {"traces": traces, "count": len(traces)}

    @app.get("/api/sessions")
    def api_sessions(limit: int = Query(50, le=500)):
        sessions = get_session_list(limit=limit)
        return {"sessions": sessions, "count": len(sessions)}

    @app.get("/api/errors")
    def api_errors(limit: int = Query(100, le=1000)):
        errors = get_error_log(limit=limit)
        return {"errors": errors, "count": len(errors)}

    @app.get("/api/rlhf")
    def api_rlhf(
        limit: int = Query(100, le=1000),
        signal: Optional[str] = Query(None),
    ):
        entries = get_rlhf_log(limit=limit, signal_filter=signal)
        return {"rlhf": entries, "count": len(entries)}

    @app.get("/api/session/{session_id}")
    def api_session_detail(session_id: str):
        history  = load_session_history(session_id)
        traces   = get_pipeline_traces(session_id=session_id, limit=100)
        errors   = [e for e in get_error_log(limit=500) if e["session_id"] == session_id]
        rlhf     = [r for r in get_rlhf_log(limit=500) if r["session_id"] == session_id]
        return {
            "session_id": session_id,
            "history":    history,
            "traces":     traces,
            "errors":     errors,
            "rlhf":       rlhf,
        }

    @app.get("/api/stats")
    def api_stats():
        sessions = get_session_list(limit=1000)
        errors   = get_error_log(limit=1000)
        rlhf     = get_rlhf_log(limit=1000)
        traces   = get_pipeline_traces(limit=1000)

        total_queries = sum(s.get("query_count", 0) for s in sessions)
        total_errors  = len(errors)
        positive_rlhf = sum(1 for r in rlhf if r.get("signal") == "positive")
        negative_rlhf = sum(1 for r in rlhf if r.get("signal") == "negative")

        # Average total pipeline latency across all traces
        avg_latency_ms = 0.0
        latencies = []
        for trace in traces:
            events = trace.get("events", [])
            if events:
                total = sum(e.get("latency_ms", 0) for e in events)
                latencies.append(total)
        if latencies:
            avg_latency_ms = sum(latencies) / len(latencies)

        # Node-level average latency
        node_latencies: dict[str, list[float]] = defaultdict(list)
        for trace in traces:
            for event in trace.get("events", []):
                node_latencies[event["node"]].append(event.get("latency_ms", 0))
        node_avg = {
            node: round(sum(vals) / len(vals), 1)
            for node, vals in node_latencies.items()
        }

        return {
            "total_sessions":   len(sessions),
            "total_queries":    total_queries,
            "total_errors":     total_errors,
            "error_rate":       round(total_errors / max(total_queries, 1) * 100, 1),
            "positive_rlhf":    positive_rlhf,
            "negative_rlhf":    negative_rlhf,
            "avg_latency_ms":   round(avg_latency_ms, 1),
            "node_avg_latency": node_avg,
        }

    # ── Command Center API routes ─────────────────────────────────────────

    @app.get("/api/connections")
    def api_get_connections():
        connections = get_connections()
        active = get_active_connection()
        return {
            "connections": connections,
            "active_alias": active
        }

    @app.post("/api/connections")
    def api_save_connections(config: dict = Body(...)):
        connections = get_connections()
        alias = config.get("alias")
        if not alias:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Alias is required")
            
        # Update or add
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

    @app.post("/api/connections/test")
    def api_test_connection(config: dict = Body(...)):
        try:
            connect_args = {k: v for k, v in config.items() if k != "alias"}
            test_db = Arivu.connect(**connect_args)
            test_db.close()
            return {"status": "success"}
        except Exception as e:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail=str(e))

    @app.post("/api/connections/active")
    def api_set_active_connection(payload: dict = Body(...)):
        global global_db
        alias = payload.get("alias")
        connections = get_connections()
        config = next((c for c in connections if c.get("alias") == alias), None)
        
        if not config:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Connection alias not found")
            
        try:
            connect_args = {k: v for k, v in config.items() if k != "alias"}
            new_db = Arivu.connect(**connect_args)
            global_db = new_db
            set_active_connection(alias)
            return {"status": "success"}
        except Exception as e:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail=str(e))

    @app.get("/api/llm")
    def api_get_llm():
        from ...llm.providers import list_providers
        config = get_llm_config()
        return {
            "config": config or {},
            "providers": list_providers()
        }

    @app.post("/api/llm")
    def api_save_llm(config: dict = Body(...)):
        save_llm_config(config)
        from ...llm.providers import get_llm
        get_llm.cache_clear()
        logger.info(f"Saved new LLM config. Cache cleared. provider={config.get('provider')}")
        return {"status": "success"}



    @app.post("/api/chat")
    async def api_chat(req: dict = Body(...)):
        if not global_db:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Database not connected. Please configure connection first.")
            
        def _run():
            from ...pipeline.runner import run_pipeline
            pipeline_input = global_db.query(req.get("message", ""))
            if req.get("session_id"):
                pipeline_input["session_id"] = req.get("session_id")
            return run_pipeline(pipeline_input)
            
        result = await asyncio.to_thread(_run)
        return {
            "response": result.response,
            "sql": result.sql,
            "error": result.error
        }


    # ── WebSocket live feed ───────────────────────────────────────────────

    @app.websocket("/ws/live")
    async def ws_live(websocket: WebSocket):
        await manager.connect(websocket)
        try:
            while True:
                # Keep connection alive, client drives re-fetch via REST
                await asyncio.sleep(30)
                await websocket.send_json({"type": "ping"})
        except WebSocketDisconnect:
            manager.disconnect(websocket)

    @app.get("/api/health")
    def health():
        return {"status": "ok", "ts": time.time()}

    # ── Serve the React frontend ──────────────────────────────────────────
    import os
    static_dir = os.path.join(os.path.dirname(__file__), "frontend", "dist")
    if os.path.isdir(static_dir):
        app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")))

        @app.get("/{full_path:path}")
        def serve_spa(full_path: str):
            return FileResponse(os.path.join(static_dir, "index.html"))

    return app, manager