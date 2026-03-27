"""
examples/integration_usage.py
────────────────────────────────
All integration adapters — Telegram, WhatsApp, REST, and custom extensions.

Replace the placeholder values (YOUR_*) with your actual credentials before running.
"""

import os
from arivu import Arivu
from arivu.integrations import (
    TelegramIntegration,
    WhatsAppIntegration,
    RESTIntegration,
)


# ─────────────────────────────────────────
# Shared DB connection
# Replace with your own database credentials.
# ─────────────────────────────────────────

db = Arivu.connect(
    host="YOUR_DB_HOST",           # e.g. "db.example.supabase.com"
    port=5432,                     # e.g. 5432 for PostgreSQL
    user="YOUR_DB_USER",           # e.g. "postgres"
    password="YOUR_DB_PASSWORD",   # e.g. "supersecret"
    dbname="YOUR_DB_NAME",         # e.g. "mydb"
    mode="user",                   # "user" (read-only) or "admin" (DML allowed)
    ttl=3600,
    dialect="postgresql",          # "postgresql", "mysql", or "sqlite"
)


# ─────────────────────────────────────────
# 1. Telegram bot (user mode)
# Get your token from @BotFather on Telegram.
# ─────────────────────────────────────────

# telegram_bot = TelegramIntegration(
#     db=db,
#     token="YOUR_TELEGRAM_BOT_TOKEN",
#     admin_user_ids=[123456789],   # your numeric Telegram user ID
# )
#
# # Start (blocking — runs until Ctrl+C)
# telegram_bot.start()


# ─────────────────────────────────────────
# 2. Telegram — admin mode
# Admin mode routes destructive SQL through a human-approval gate.
# ─────────────────────────────────────────

# db_admin = Arivu.connect(
#     host="YOUR_DB_HOST",
#     port=5432,
#     user="YOUR_DB_USER",
#     password="YOUR_DB_PASSWORD",
#     dbname="YOUR_DB_NAME",
#     mode="admin",
#     ttl=3600,
#     dialect="postgresql",
# )
#
# admin_bot = TelegramIntegration(
#     db=db_admin,
#     token="YOUR_TELEGRAM_BOT_TOKEN",
#     admin_user_ids=[YOUR_TELEGRAM_USER_ID],  # replace with your numeric user ID
# )
#
# admin_bot.start()


# ─────────────────────────────────────────
# 3. WhatsApp bot (via Twilio)
# Requires a Twilio account and a WhatsApp-enabled Sandbox number.
# ─────────────────────────────────────────

# os.environ["TWILIO_ACCOUNT_SID"]     = "YOUR_TWILIO_ACCOUNT_SID"
# os.environ["TWILIO_AUTH_TOKEN"]      = "YOUR_TWILIO_AUTH_TOKEN"
# os.environ["TWILIO_WHATSAPP_FROM"]   = "whatsapp:+14155238886"  # Twilio sandbox number
# os.environ["TWILIO_SKIP_VALIDATION"] = "1"                      # dev only
#
# whatsapp_bot = WhatsAppIntegration(
#     db=db,
#     admin_numbers=["+91XXXXXXXXXX"],   # your WhatsApp number for admin approvals
# )
#
# # Start Flask webhook server (blocking)
# whatsapp_bot.start(host="0.0.0.0", port=8000)

# Or get the Flask app for Gunicorn:
# flask_app = whatsapp_bot.get_flask_app()
# gunicorn command: gunicorn "main:flask_app"


# ─────────────────────────────────────────
# 4. REST API (FastAPI)
# ─────────────────────────────────────────

# rest_api = RESTIntegration(db=db)
#
# # Start locally (blocking)
# rest_api.start(host="0.0.0.0", port=8000)

# Or get the FastAPI app for Uvicorn:
# fastapi_app = rest_api.get_fastapi_app()
# uvicorn command: uvicorn main:fastapi_app --host 0.0.0.0 --port 8000


# ─────────────────────────────────────────
# 5. REST API — curl examples
# ─────────────────────────────────────────

# Query:
# curl -X POST http://localhost:8000/query \
#   -H "X-Api-Key: YOUR_API_KEY" \
#   -H "Content-Type: application/json" \
#   -d '{"question": "show me top 10 orders", "user_id": "user_001"}'
#
# Approve a pending admin op:
# curl -X POST http://localhost:8000/approve/sess-abc123 \
#   -H "X-Api-Key: YOUR_API_KEY"
#
# Submit RLHF feedback:
# curl -X POST http://localhost:8000/feedback/sess-abc123 \
#   -H "X-Api-Key: YOUR_API_KEY" \
#   -H "Content-Type: application/json" \
#   -d '{"signal": "positive"}'
#
# Health check:
# curl http://localhost:8000/health


# ─────────────────────────────────────────
# 6. Custom integration (extend BaseIntegration)
# ─────────────────────────────────────────

# from arivu.integrations import BaseIntegration
#
# class SlackIntegration(BaseIntegration):
#     """Example skeleton for a custom Slack integration."""
#
#     def start(self) -> None:
#         # Wire up Slack Bolt / SocketMode here
#         pass
#
#     def stop(self) -> None:
#         pass
#
#     def send_message(self, user_id: str, text: str) -> None:
#         # client.chat_postMessage(channel=user_id, text=text)
#         pass
#
#     def send_approval_request(
#         self, user_id: str, sql: str, question: str, session_id: str
#     ) -> None:
#         # Post interactive Block Kit message with approve/reject buttons
#         pass
#
# # Use it identically to Telegram or WhatsApp:
# # slack = SlackIntegration(db=db)
# # result = slack.handle_query(user_id="U123ABC", text="how many users signed up today?")