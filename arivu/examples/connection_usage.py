"""
examples/connection_usage.py
─────────────────────────────
Demonstrates all connection layer patterns.
Run with: python examples/connection_usage.py

Replace the placeholder values (YOUR_*) with your actual credentials before running.
"""

from arivu import Arivu
from arivu.connection.exceptions import AuthError, ModeViolationError


# ─────────────────────────────────────────
# 1. Basic connect + query (user mode)
# User mode is read-only — no INSERT/UPDATE/DELETE/DROP allowed.
# ─────────────────────────────────────────

# db = Arivu.connect(
#     host="your-db-host",           # e.g. "db.example.supabase.com"
#     port=6543,                     # default PostgreSQL port
#     user="your-db-user",           # e.g. "postgres"
#     password="your-db-password",   # e.g. "supersecret"
#     dbname="your-db-name",         # e.g. "mydb"
#     mode="user",                   # "user" (read-only) or "admin" (DML allowed)
#     ttl=3600,                      # schema cache TTL in seconds
#     dialect="postgresql",          # "postgresql", "mysql", or "sqlite"
# )

# print(db)
# <Arivu session=a3f1b2c4  mode=user  schema=fresh>

# Hand off to the agentic pipeline
# pipeline_input = db.query("show me the top 10 customers by total spend")
# print(pipeline_input.keys())
# dict_keys(['question', 'schema_ctx', 'vector_store', 'session_id', 'mode', 'engine'])


# ─────────────────────────────────────────
# 2. Admin mode
# Admin mode allows DML — destructive operations are routed through
# a human-approval gate before execution.
# ─────────────────────────────────────────

# admin_db = Arivu.connect(
#     host="YOUR_DB_HOST",
#     port=5432,
#     user="YOUR_DB_USER",
#     password="YOUR_DB_PASSWORD",
#     dbname="YOUR_DB_NAME",
#     mode="admin",       # full DDL — destructive ops go through RLHF gate in pipeline
#     ttl=1800,
#     dialect="postgresql",
# )
#
# pipeline_input = admin_db.query("add an index on orders.created_at")


# ─────────────────────────────────────────
# 3. SQLite (local file, zero infra)
# ─────────────────────────────────────────

# sqlite_db = Arivu.connect(
#     dialect="sqlite",
#     dbname="/path/to/your/local.db",
#     mode="user",
# )
