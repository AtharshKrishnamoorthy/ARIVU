"""
arivu.dashboard.server
─────────────────────────────
FastAPI backend for the Arivu tracing dashboard.

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
import logging
import time
import os

logger = logging.getLogger("arivu.dashboard.server")

def create_dashboard_app():
    try:
        from fastapi import FastAPI, WebSocket, WebSocketDisconnect
        from fastapi.middleware.cors import CORSMiddleware
        from fastapi.staticfiles import StaticFiles
        from fastapi.responses import FileResponse
    except ImportError:
        raise ImportError(
            "fastapi and uvicorn are required for the dashboard. "
            "Install with: pip install fastapi uvicorn"
        )

    from .routers import monitoring, connections, llm, chat, visualize, export, suggestions, automations, settings, dashboards
    from ...memory.store import get_active_connection, get_connections
    from ...connection.core import Arivu

    app = FastAPI(title="Arivu Dashboard", version="0.1.0")

    def _init_global_state():
        # Cleanly initialize app state to None on boot. 
        # Connections are now officially loaded entirely lazily via dependencies.py!
        app.state.arivu_db = None

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

        async def connect(self, websocket: WebSocket):
            await websocket.accept()
            self.active.append(websocket)

        def disconnect(self, websocket: WebSocket):
            if websocket in self.active:
                self.active.remove(websocket)

        async def broadcast(self, message: dict):
            disconnected = []
            for connection in self.active:
                try:
                    await connection.send_json(message)
                except Exception:
                    disconnected.append(connection)
            for d in disconnected:
                self.disconnect(d)

    manager = ConnectionManager()

    # Mount APIRouters
    app.include_router(monitoring.router)
    app.include_router(connections.router)
    app.include_router(llm.router)
    app.include_router(chat.router)
    app.include_router(visualize.router)
    app.include_router(export.router)
    app.include_router(suggestions.router)
    app.include_router(automations.router)
    app.include_router(settings.router)
    app.include_router(dashboards.router)

    # ── Load scheduled automations on startup ────────────────────────────
    try:
        from .services.scheduler import load_all_jobs
        load_all_jobs()
    except Exception as exc:
        logger.warning(f"[scheduler] failed to load automations: {exc}")

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
    static_dir = os.path.join(os.path.dirname(__file__), "frontend", "dist")
    if os.path.isdir(static_dir):
        app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")))

        @app.get("/{full_path:path}")
        def serve_spa(full_path: str):
            # For Next.js dynamic routes, we point everything unknown to index.html
            return FileResponse(os.path.join(static_dir, "index.html"))

    return app, manager