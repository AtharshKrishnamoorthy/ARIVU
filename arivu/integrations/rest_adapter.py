"""
arivu.integrations.rest
──────────────────────────────
REST API integration for arivu.

Exposes the pipeline as a clean HTTP API so any client (web app, CLI,
custom bot) can query the database via NL without using Telegram or WhatsApp.

Endpoints:
    POST /query             — run a NL query
    POST /approve/{sid}     — approve a pending admin operation
    POST /reject/{sid}      — reject a pending admin operation
    POST /feedback/{sid}    — submit RLHF signal
    GET  /session/{sid}     — get session history
    GET  /health            — liveness check

Usage:
    from arivu import Arivu
    from arivu.integrations.rest import RESTIntegration

    db = Arivu.connect(host=..., mode="user")
    api = RESTIntegration(db)
    api.start(host="0.0.0.0", port=8000)   # runs uvicorn

Requires:
    pip install fastapi uvicorn
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from .base import BaseIntegration
from ..connection.core import Arivu
from ..pipeline.runner import run_pipeline, PipelineConfig

# Pydantic models and FastAPI imports at module level so that
# Pydantic can fully resolve all type hints at schema-generation
# time (avoids ForwardRef / 500 on /openapi.json errors).
try:
    from fastapi import FastAPI, HTTPException, Depends, Header
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel

    class QueryRequest(BaseModel):
        question: str
        user_id: str = "rest_user"
        rlhf_signal: Optional[str] = None
        max_query_chars: Optional[int] = None
        max_result_rows: Optional[int] = None

    class QueryResponse(BaseModel):
        response: str
        sql: str
        success: bool
        pending_approval: bool
        session_id: str
        error: Optional[str] = None
        results_truncated: bool = False
        limit_max_query_chars: Optional[int] = None
        limit_max_result_rows: Optional[int] = None

    class FeedbackRequest(BaseModel):
        signal: str   # "positive" | "negative"

except ImportError:
    FastAPI = HTTPException = Depends = Header = None          # type: ignore
    CORSMiddleware = BaseModel = None                          # type: ignore
    QueryRequest = QueryResponse = FeedbackRequest = None      # type: ignore

logger = logging.getLogger("arivu.integrations.rest")


class RESTIntegration(BaseIntegration):
    """
    FastAPI adapter. Useful for web apps, CLI tools, and custom bots.
    """

    def __init__(
        self,
        db: Arivu,
        api_key: Optional[str] = None,
        *,
        max_query_chars: int = 10_000,
        max_result_rows: int = 10_000,
        max_retries: int = 3,
    ) -> None:
        super().__init__(db)
        self.api_key = api_key or os.environ.get("ARIVU_API_KEY")
        self._responses: dict[str, str] = {}   # session_id → queued response
        self.config = PipelineConfig(
            max_query_chars=max_query_chars,
            max_result_rows=max_result_rows,
            max_retries=max_retries,
        )

    def start(self, host: str = "0.0.0.0", port: int = 8000) -> None:
        import uvicorn
        app = self.get_fastapi_app()
        logger.info(f"REST API starting on {host}:{port}")
        uvicorn.run(app, host=host, port=port)

    def stop(self) -> None:
        logger.info("REST integration stopped.")

    def send_message(self, user_id: str, text: str) -> None:
        # In REST mode, responses are returned directly in the HTTP response
        self._responses[user_id] = text

    def send_approval_request(
        self, user_id: str, sql: str, question: str, session_id: str
    ) -> None:
        # In REST mode the response body signals pending_approval=True
        logger.info(f"[rest] approval required  session={session_id}")

    def get_fastapi_app(self):
        if FastAPI is None:
            raise ImportError(
                "fastapi and uvicorn are required. "
                "Install with: pip install fastapi uvicorn"
            )

        app = FastAPI(
            title="Arivu API",
            description="Natural language database query API",
            version="0.1.0",
        )
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["*"],
            allow_headers=["*"],
        )

        integration = self

        # ── Auth dependency ──────────────────────────────────────────────
        def verify_api_key(x_api_key: Optional[str] = Header(None)):
            if integration.api_key and x_api_key != integration.api_key:
                raise HTTPException(status_code=401, detail="Invalid API key")

        # ── Endpoints ───────────────────────────────────────────────────

        @app.post("/query", response_model=QueryResponse, dependencies=[Depends(verify_api_key)])
        def query(req: QueryRequest):
            cfg = PipelineConfig(
                max_query_chars=req.max_query_chars or integration.config.max_query_chars,
                max_result_rows=req.max_result_rows or integration.config.max_result_rows,
                max_retries=integration.config.max_retries,
            )
            pipeline_input = integration.db.query(req.question)
            pipeline_input["session_id"] = integration._session_for(req.user_id)
            result = run_pipeline(pipeline_input, rlhf_signal=req.rlhf_signal, config=cfg)
            return QueryResponse(
                response=result.response,
                sql=result.sql,
                success=result.success,
                pending_approval=result.pending_approval,
                session_id=result.session_id,
                error=result.error,
                results_truncated=result.results_truncated,
                limit_max_query_chars=cfg.max_query_chars,
                limit_max_result_rows=cfg.max_result_rows,
            )

        @app.post("/approve/{session_id}", dependencies=[Depends(verify_api_key)])
        def approve(session_id: str, user_id: str = "admin"):
            integration.handle_approve(user_id, session_id)
            return {"status": "approved", "session_id": session_id}

        @app.post("/reject/{session_id}", dependencies=[Depends(verify_api_key)])
        def reject(session_id: str, user_id: str = "admin"):
            integration.handle_reject(user_id, session_id)
            return {"status": "rejected", "session_id": session_id}

        @app.post("/feedback/{session_id}", dependencies=[Depends(verify_api_key)])
        def feedback(session_id: str, req: FeedbackRequest):
            from ..memory.store import save_rlhf_signal
            save_rlhf_signal(
                session_id=session_id,
                question="", sql="",
                signal=req.signal,
            )
            return {"status": "ok", "signal": req.signal}

        @app.get("/session/{session_id}", dependencies=[Depends(verify_api_key)])
        def session_history(session_id: str):
            from ..memory.store import load_session_history
            return {"history": load_session_history(session_id)}

        @app.post("/refresh", dependencies=[Depends(verify_api_key)])
        def refresh_schema():
            integration.db.refresh_schema()
            return {"status": "ok", "message": "Schema refreshed"}

        @app.get("/health")
        def health():
            return {
                "status": "ok",
                "integration": "rest",
                "schema_age_seconds": integration.db.schema_age_seconds,
                "mode": integration.db.mode,
            }

        @app.get("/config", dependencies=[Depends(verify_api_key)])
        def get_config():
            return {
                "max_query_chars": integration.config.max_query_chars,
                "max_result_rows": integration.config.max_result_rows,
                "max_retries": integration.config.max_retries,
            }

        return app