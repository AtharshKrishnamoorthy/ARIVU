"""
arivu.integrations.slack_adapter
────────────────────────────────────────
Slack integration for Arivu using Slack Bolt.

Features:
  - NL queries via direct messages and @mentions in channels
  - /dh-query slash command
  - /dh-refresh slash command
  - Approve / Reject buttons on destructive SQL (Block Kit)
  - 👍 / 👎 emoji reactions for RLHF feedback
  - Thread replies — responses stay in thread, not channel noise

Setup:
    1. Create a Slack App at https://api.slack.com/apps
    2. Enable Socket Mode (easiest) or HTTP Events
    3. Add Bot Token Scopes:
         app_mentions:read, channels:history, chat:write,
         commands, reactions:read, im:history, im:write
    4. Install app to workspace
    5. Set env vars:

    export SLACK_BOT_TOKEN=xoxb-...
    export SLACK_APP_TOKEN=xapp-...     # for Socket Mode
    export SLACK_SIGNING_SECRET=...     # for HTTP mode

Usage:
    from arivu import Arivu
    from arivu.integrations.slack import SlackIntegration

    db = Arivu.connect(host=..., mode="user")
    bot = SlackIntegration(db)
    bot.start()   # Socket Mode — no public URL needed

Requires:
    pip install slack-bolt
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from .base import BaseIntegration
from ..connection.core import Arivu

logger = logging.getLogger("arivu.integrations.slack")


class SlackIntegration(BaseIntegration):
    """
    Slack adapter for arivu.

    Supports Socket Mode (zero infra, recommended for dev + internal tools)
    and HTTP mode (for production deployments with a public URL).

    Session identity: "slack:{user_id}"
    """

    def __init__(
        self,
        db: Arivu,
        bot_token: Optional[str] = None,
        app_token: Optional[str] = None,
        signing_secret: Optional[str] = None,
        admin_user_ids: Optional[list[str]] = None,
    ) -> None:
        super().__init__(db)
        self.bot_token      = bot_token      or os.environ["SLACK_BOT_TOKEN"]
        self.app_token      = app_token      or os.environ.get("SLACK_APP_TOKEN", "")
        self.signing_secret = signing_secret or os.environ.get("SLACK_SIGNING_SECRET", "")
        self.admin_user_ids = set(admin_user_ids or [])
        self._app = None
        self._webclient = None

    # ─────────────────────────────────────────
    # Lifecycle
    # ─────────────────────────────────────────

    def start(self, socket_mode: bool = True, port: int = 3000) -> None:
        self._app = self._build_app()
        if socket_mode:
            from slack_bolt.adapter.socket_mode import SocketModeHandler
            logger.info("Slack bot starting in Socket Mode...")
            SocketModeHandler(self._app, self.app_token).start()
        else:
            logger.info(f"Slack bot starting in HTTP mode on port {port}...")
            self._app.start(port=port)

    def stop(self) -> None:
        logger.info("Slack bot stopped.")

    def get_flask_app(self):
        """Return a Flask-compatible WSGI app for HTTP mode deployment."""
        from slack_bolt.adapter.flask import SlackRequestHandler
        from flask import Flask, request
        self._app = self._build_app()
        flask_app = Flask("arivu_slack")
        handler = SlackRequestHandler(self._app)

        @flask_app.route("/slack/events", methods=["POST"])
        def events():
            return handler.handle(request)

        return flask_app

    # ─────────────────────────────────────────
    # Send helpers
    # ─────────────────────────────────────────

    @property
    def _client(self):
        """Lazy standalone WebClient — works without calling start() / _build_app()."""
        if self._webclient is None:
            try:
                from slack_sdk import WebClient
            except ImportError:
                raise ImportError(
                    "slack-sdk is required for sending messages. "
                    "Install with: pip install slack-sdk"
                )
            self._webclient = WebClient(token=self.bot_token)
        return self._webclient

    def send_message(self, user_id: str, text: str) -> None:
        """Send a message to a channel or DM — works with or without start()."""
        self._client.chat_postMessage(
            channel=user_id,
            text=text,
            mrkdwn=True,
        )

    def send_approval_request(
        self,
        user_id: str,
        sql: str,
        question: str,
        session_id: str,
    ) -> None:
        """Send Block Kit approval message to all admin users."""
        blocks = _build_approval_blocks(sql, question, session_id)
        for admin_id in (self.admin_user_ids or {user_id}):
            self._client.chat_postMessage(
                channel=admin_id,
                text=f"Approval required: {question}",
                blocks=blocks,
            )


    # ─────────────────────────────────────────
    # App builder
    # ─────────────────────────────────────────

    def _build_app(self):
        try:
            from slack_bolt import App
        except ImportError:
            raise ImportError(
                "slack-bolt is required. Install with: pip install slack-bolt"
            )

        app = App(
            token=self.bot_token,
            signing_secret=self.signing_secret or None,
        )
        integration = self

        # ── Slash commands ───────────────────────────────────────────────

        @app.command("/dh-query")
        def cmd_query(ack, body, respond):
            ack()
            user_id = body["user_id"]
            text    = body.get("text", "").strip()
            if not text:
                respond("Usage: `/dh-query how many orders were placed today?`")
                return
            respond({"text": "⏳ Thinking...", "response_type": "ephemeral"})
            result = integration.handle_query(user_id, text)
            if result.success and not result.pending_approval:
                respond({
                    "text": result.response,
                    "blocks": _build_response_blocks(result.response, result.session_id),
                    "response_type": "in_channel",
                })
            elif not result.success:
                respond(f"⚠️ Error: {result.error}")

        @app.command("/dh-refresh")
        def cmd_refresh(ack, respond):
            ack()
            try:
                integration.db.refresh_schema()
                respond("✅ Schema refreshed successfully.")
            except Exception as exc:
                respond(f"⚠️ Refresh failed: {exc}")

        # ── App mention (@bot query) ─────────────────────────────────────

        @app.event("app_mention")
        def handle_mention(event, say):
            user_id = event["user"]
            # strip the mention from the text
            text = event["text"].split(">", 1)[-1].strip()
            if not text:
                say("Hi! Ask me anything about your database. Example: `@ARIVU how many orders today?`")
                return
            thread_ts = event.get("thread_ts") or event["ts"]
            say(text="⏳ Thinking...", thread_ts=thread_ts)
            result = integration.handle_query(user_id, text)
            if result.success and not result.pending_approval:
                say(
                    blocks=_build_response_blocks(result.response, result.session_id),
                    text=result.response,
                    thread_ts=thread_ts,
                )
            elif not result.success:
                say(f"⚠️ {result.response}", thread_ts=thread_ts)

        # ── Direct messages ──────────────────────────────────────────────

        @app.event("message")
        def handle_dm(event, say, client):
            if event.get("channel_type") != "im":
                return
            if event.get("subtype"):
                return
            user_id = event["user"]
            text    = event.get("text", "").strip()
            if not text:
                return
            result = integration.handle_query(user_id, text)
            if result.success and not result.pending_approval:
                client.chat_postMessage(
                    channel=event["channel"],
                    blocks=_build_response_blocks(result.response, result.session_id),
                    text=result.response,
                )
            elif not result.success:
                client.chat_postMessage(
                    channel=event["channel"],
                    text=f"⚠️ {result.response}",
                )

        # ── Block Kit button actions (approve / reject) ──────────────────

        @app.action("dh_approve")
        def handle_approve(ack, body, action, client):
            ack()
            user_id    = body["user"]["id"]
            session_id = action["value"]
            if not integration._is_admin(user_id):
                client.chat_postMessage(channel=user_id, text="❌ You don't have admin permissions.")
                return
            integration.handle_approve(user_id, session_id)
            client.chat_update(
                channel=body["container"]["channel_id"],
                ts=body["container"]["message_ts"],
                text=f"✅ Approved by <@{user_id}>",
                blocks=[],
            )

        @app.action("dh_reject")
        def handle_reject(ack, body, action, client):
            ack()
            user_id    = body["user"]["id"]
            session_id = action["value"]
            if not integration._is_admin(user_id):
                client.chat_postMessage(channel=user_id, text="❌ You don't have admin permissions.")
                return
            integration.handle_reject(user_id, session_id)
            client.chat_update(
                channel=body["container"]["channel_id"],
                ts=body["container"]["message_ts"],
                text=f"❌ Rejected by <@{user_id}>",
                blocks=[],
            )

        # ── RLHF button actions (thumbs up / down) ───────────────────────

        @app.action("dh_rlhf_positive")
        def rlhf_positive(ack, body, action):
            ack()
            _save_rlhf(action["value"], "positive")

        @app.action("dh_rlhf_negative")
        def rlhf_negative(ack, body, action):
            ack()
            _save_rlhf(action["value"], "negative")

        return app

    def _is_admin(self, user_id: str) -> bool:
        if not self.admin_user_ids:
            return True
        return user_id in self.admin_user_ids


# ─────────────────────────────────────────────────────────────────────────────
# Block Kit builders
# ─────────────────────────────────────────────────────────────────────────────

def _build_response_blocks(response: str, session_id: str) -> list:
    return [
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": response},
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "👍 Helpful"},
                    "action_id": "dh_rlhf_positive",
                    "value": session_id,
                    "style": "primary",
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "👎 Not helpful"},
                    "action_id": "dh_rlhf_negative",
                    "value": session_id,
                },
            ],
        },
    ]


def _build_approval_blocks(sql: str, question: str, session_id: str) -> list:
    return [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": "🔐 Admin Approval Required"},
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Question:*\n{question}"},
                {"type": "mrkdwn", "text": f"*Session:*\n`{session_id[:12]}`"},
            ],
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*SQL to execute:*\n```{sql}```"},
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "✅ Approve"},
                    "action_id": "dh_approve",
                    "value": session_id,
                    "style": "primary",
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "❌ Reject"},
                    "action_id": "dh_reject",
                    "value": session_id,
                    "style": "danger",
                },
            ],
        },
    ]


def _save_rlhf(session_id: str, signal: str) -> None:
    try:
        from ..memory.store import save_rlhf_signal
        save_rlhf_signal(session_id=session_id, question="", sql="", signal=signal)
    except Exception as exc:
        logger.warning(f"[slack] RLHF save failed: {exc}")