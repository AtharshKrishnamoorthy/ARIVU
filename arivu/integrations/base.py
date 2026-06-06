"""
arivu.integrations.base
──────────────────────────────
Base adapter interface that all integrations implement.

Every integration is responsible for exactly three things:
  1. Receive a message from its platform
  2. Route it through the Arivu pipeline
  3. Send the response back

Nothing else. No SQL logic, no memory management, no LLM calls.

Each integration also handles:
  - The admin approval flow (/approve, /reject commands)
  - RLHF signal collection (thumbs up/down, reactions)
  - Session identity (mapping platform user IDs → Arivu session IDs)
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Optional

from ..connection.core import Arivu
from ..pipeline.runner import run_pipeline, PipelineResult
from ..memory.store import resolve_approval, get_pending_approval

logger = logging.getLogger("arivu.integrations")


class BaseIntegration(ABC):
    """
    Abstract base for all Arivu integrations.

    Subclasses must implement:
        start()           — begin listening for messages
        stop()            — graceful shutdown
        send_message()    — deliver a text response to a user
        send_approval_request() — surface a pending SQL to the admin
    """

    def __init__(self, db: ARIVU) -> None:
        self.db = db
        self._running = False

    # ─────────────────────────────────────────
    # Lifecycle
    # ─────────────────────────────────────────

    @abstractmethod
    def start(self) -> None:
        """Start the integration listener (blocking or async)."""

    @abstractmethod
    def stop(self) -> None:
        """Graceful shutdown."""

    # ─────────────────────────────────────────
    # Messaging
    # ─────────────────────────────────────────

    @abstractmethod
    def send_message(self, user_id: str, text: str) -> None:
        """Send a plain text message to the user."""

    @abstractmethod
    def send_approval_request(
        self,
        user_id: str,
        sql: str,
        question: str,
        session_id: str,
    ) -> None:
        """
        Surface a pending destructive SQL to the admin for approval.
        The integration should present the SQL clearly and provide
        approve / reject affordances (/approve, /reject or inline buttons).
        """

    # ─────────────────────────────────────────
    # Core pipeline routing (shared by all integrations)
    # ─────────────────────────────────────────

    def handle_query(
        self,
        user_id: str,
        text: str,
        rlhf_signal: Optional[str] = None,
    ) -> PipelineResult:
        """
        Route a NL query through the full Arivu pipeline AND send the result.
        Handles the approval gate and RLHF signal transparently.

        Returns PipelineResult so the caller can inspect it if needed.
        NOTE: Do NOT call this from inside an async executor thread if
        send_message uses the same event loop — use _run_pipeline_only instead.
        """
        result = self._run_pipeline_only(user_id, text, rlhf_signal)

        if result.pending_approval:
            self.send_approval_request(
                user_id=user_id,
                sql=result.sql,
                question=text,
                session_id=result.session_id,
            )
            self.send_message(
                user_id,
                "⏳ This operation requires admin approval before it can run. "
                "Your request has been sent for review.",
            )
        else:
            self.send_message(user_id, result.response)

        return result

    def _run_pipeline_only(
        self,
        user_id: str,
        text: str,
        rlhf_signal: Optional[str] = None,
    ) -> PipelineResult:
        """
        Run the pipeline and return the result WITHOUT sending any message.

        Use this from async handlers that handle sending themselves
        (e.g. Telegram _handle_text), so that no Telegram API calls are
        made from worker threads where the event loop is unavailable.
        """
        pipeline_input = self.db.query(text)
        pipeline_input["session_id"] = self._session_for(user_id)

        logger.info(f"[integration] query  user={user_id}  text='{text[:70]}'")

        result = run_pipeline(pipeline_input, rlhf_signal=rlhf_signal)

        status = "ok" if result.success else f"error({result.error_node})"
        logger.info(f"[integration] result  status={status}  pending_approval={result.pending_approval}")
        if result.response:
            logger.debug(f"[integration] response: {result.response[:120]}")

        return result

    def handle_approve(self, user_id: str, session_id: str) -> None:
        pending = get_pending_approval(session_id)
        if not pending:
            self.send_message(user_id, "No pending approval found for this session.")
            return

        # Re-run sanitizer before executing approved SQL (defense-in-depth)
        from ..pipeline.sanitizer import sanitize_sql
        safe, reason = sanitize_sql(pending["sql"])
        if not safe:
            resolve_approval(session_id, approved=False)
            logger.warning(f"[integration] approved SQL rejected by sanitizer: {reason}")
            self.send_message(user_id, f"❌ SQL rejected on re-check: {reason}")
            return

        resolve_approval(session_id, approved=True)
        logger.info(f"[integration] approved  session={session_id[:12]}  user={user_id}")

        # Execute the already-verified SQL directly — no pipeline re-run
        try:
            from sqlalchemy import text
            with self.db._engine.connect() as conn:
                result = conn.execute(text(pending["sql"]))
                conn.commit()
                affected = result.rowcount if result.rowcount is not None else 0

            logger.info(f"[integration] approved SQL executed  rows_affected={affected}")
            self.send_message(
                user_id,
                f"✅ Executed successfully.\n\n"
                f"SQL: `{pending['sql']}`\n"
                f"Rows affected: {affected}"
            )

        except Exception as exc:
            logger.error(f"[integration] approved SQL execution failed: {exc}")
            self.send_message(
                user_id,
                f"❌ Approval granted but execution failed.\n"
                f"Error: {exc}"
            )

    def handle_reject(self, user_id: str, session_id: str) -> None:
        """Called when an admin sends /reject."""
        resolve_approval(session_id, approved=False)
        logger.info(f"[integration] rejected  session={session_id}  user={user_id}")
        logger.info(f"[integration] rejected  session={session_id[:12]}  user={user_id}")
        self.send_message(user_id, "❌ Operation rejected. Nothing was changed.")

    # ─────────────────────────────────────────
    # Session identity
    # ─────────────────────────────────────────

    def _session_for(self, user_id: str) -> str:
        """
        Map a platform user ID to a stable Arivu session ID.
        Format: {integration_name}:{user_id}
        """
        return f"{self.__class__.__name__.lower()}:{user_id}"

    # ─────────────────────────────────────────
    # Formatting helpers (available to all adapters)
    # ─────────────────────────────────────────

    @staticmethod
    def format_approval_message(sql: str, question: str) -> str:
        return (
            f"🔐 *Admin approval required*\n\n"
            f"*Question:* {question}\n\n"
            f"*SQL to execute:*\n```sql\n{sql}\n```\n\n"
            f"Reply /approve or /reject"
        )

    @staticmethod
    def format_error_message(error: str, session_id: str) -> str:
        return (
            f"⚠️ Something went wrong.\n"
            f"Session: `{session_id[:8]}`\n"
            f"Please try rephrasing your question."
        )