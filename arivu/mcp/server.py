"""
arivu.mcp.server
─────────────────────────────────────────
MCP server for Arivu — lets any MCP client (Claude Desktop, Cursor, etc.)
query your database in plain English through the full Arivu pipeline.

Supports all Arivu dialects: PostgreSQL, MySQL, SQLite, Snowflake, Databricks.

Tools exposed:
    arivu_query              — ask a NL question, get a DB answer
    arivu_execute_sql        — run raw SQL (bypasses safety pipeline)
    arivu_approve            — approve a pending destructive SQL
    arivu_reject             — reject a pending destructive SQL
    arivu_refresh_schema     — force schema re-extraction
    arivu_get_schema         — see what tables/columns are available
    arivu_test_connection    — health check on the DB connection
    arivu_get_pending_approvals — list queued destructive operations
    arivu_get_session_history   — retrieve past Q&A for a session
    arivu_list_dialects      — show available DB dialects and install status

Setup:
    pip install arivu-ai[mcp]

    Set env vars for your dialect:

    # Common
    ARIVU_DB_DIALECT   = postgresql           (or mysql / sqlite / snowflake / databricks)
    ARIVU_DB_MODE      = user                 (or admin)

    # Traditional RDBMS (postgresql / mysql)
    ARIVU_DB_HOST      = your db host
    ARIVU_DB_PORT      = 5432
    ARIVU_DB_USER      = your db user
    ARIVU_DB_PASSWORD  = your db password
    ARIVU_DB_NAME      = your db name

    # Snowflake
    ARIVU_SNOWFLAKE_ACCOUNT   = xy12345.us-east-1
    ARIVU_SNOWFLAKE_WAREHOUSE = COMPUTE_WH
    ARIVU_DB_USER             = your snowflake user
    ARIVU_DB_PASSWORD         = your snowflake password
    ARIVU_DB_NAME             = your database

    # Databricks
    ARIVU_DB_HOST              = adb-123.azuredatabricks.net
    ARIVU_DATABRICKS_HTTP_PATH = /sql/1.0/endpoints/abc123
    ARIVU_DATABRICKS_TOKEN     = dapi...
    ARIVU_DATABRICKS_CATALOG   = main

Run (stdio — local, e.g. Claude Desktop):
    python -m arivu.mcp

Run (Streamable HTTP — remote, e.g. deployed server):
    python -m arivu.mcp --transport http --port 8080

Claude Desktop config (claude_desktop_config.json):
    {
      "mcpServers": {
        "arivu": {
          "command": "python",
          "args": ["-m", "arivu.mcp"],
          "env": {
            "ARIVU_DB_DIALECT": "postgresql",
            "ARIVU_DB_HOST": "...",
            "ARIVU_DB_PORT": "5432",
            "ARIVU_DB_USER": "...",
            "ARIVU_DB_PASSWORD": "...",
            "ARIVU_DB_NAME": "...",
            "ARIVU_DB_MODE": "user"
          }
        }
      }
    }
"""

from __future__ import annotations

import json
import logging
import os
import sys
from contextlib import asynccontextmanager
from typing import Any, Optional

from mcp.server.fastmcp import FastMCP, Context
from pydantic import BaseModel, Field, ConfigDict

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("arivu_mcp")


# ─────────────────────────────────────────────────────────────────────────────
# Lifespan — connect to DB once, reuse across all tool calls
# ─────────────────────────────────────────────────────────────────────────────

def _build_connect_kwargs() -> dict:
    """
    Read environment variables and build the kwargs dict for Arivu.connect().
    Supports all registered dialects.
    """
    dialect = os.environ.get("ARIVU_DB_DIALECT", "postgresql")
    mode = os.environ.get("ARIVU_DB_MODE", "user")

    connect_kwargs = {
        "dialect": dialect,
        "mode": mode,
    }

    def _safe_port(default: int = 5432) -> int:
        raw = os.environ.get("ARIVU_DB_PORT")
        if raw is None:
            return default
        try:
            return int(raw)
        except (ValueError, TypeError):
            logger.warning(f"Invalid ARIVU_DB_PORT '{raw}', using default {default}")
            return default

    if dialect in ("postgresql", "mysql"):
        connect_kwargs.update(
            host=os.environ.get("ARIVU_DB_HOST", "localhost"),
            port=_safe_port(),
            user=os.environ.get("ARIVU_DB_USER"),
            password=os.environ.get("ARIVU_DB_PASSWORD"),
            dbname=os.environ.get("ARIVU_DB_NAME"),
        )
    elif dialect == "sqlite":
        connect_kwargs.update(
            dbname=os.environ.get("ARIVU_DB_NAME", "arivu.db"),
        )
    elif dialect == "snowflake":
        connect_kwargs.update(
            account=os.environ.get("ARIVU_SNOWFLAKE_ACCOUNT"),
            user=os.environ.get("ARIVU_DB_USER"),
            password=os.environ.get("ARIVU_DB_PASSWORD"),
            dbname=os.environ.get("ARIVU_DB_NAME"),
            warehouse=os.environ.get("ARIVU_SNOWFLAKE_WAREHOUSE"),
            role=os.environ.get("ARIVU_SNOWFLAKE_ROLE"),
        )
        if not connect_kwargs["account"]:
            raise ValueError("ARIVU_SNOWFLAKE_ACCOUNT is required for snowflake dialect")
    elif dialect == "databricks":
        connect_kwargs.update(
            host=os.environ.get("ARIVU_DB_HOST"),
            http_path=os.environ.get("ARIVU_DATABRICKS_HTTP_PATH"),
            access_token=os.environ.get("ARIVU_DATABRICKS_TOKEN"),
            catalog=os.environ.get("ARIVU_DATABRICKS_CATALOG", "main"),
            schema_name=os.environ.get("ARIVU_DATABRICKS_SCHEMA", "default"),
        )
        if not connect_kwargs["host"]:
            raise ValueError("ARIVU_DB_HOST is required for databricks dialect")
        if not connect_kwargs["http_path"]:
            raise ValueError("ARIVU_DATABRICKS_HTTP_PATH is required for databricks dialect")
        if not connect_kwargs["access_token"]:
            raise ValueError("ARIVU_DATABRICKS_TOKEN is required for databricks dialect")
    else:
        # Future dialects — try basic RDBMS params
        connect_kwargs.update(
            host=os.environ.get("ARIVU_DB_HOST", "localhost"),
            port=_safe_port(),
            user=os.environ.get("ARIVU_DB_USER"),
            password=os.environ.get("ARIVU_DB_PASSWORD"),
            dbname=os.environ.get("ARIVU_DB_NAME"),
        )

    return connect_kwargs


@asynccontextmanager
async def lifespan(server: FastMCP):
    """Connect to the DB at startup, close at shutdown."""
    from arivu.connection.core import Arivu
    from arivu.connection.exceptions import ArivuError

    try:
        connect_kwargs = _build_connect_kwargs()
        dialect = connect_kwargs.get("dialect", "postgresql")

        logger.info(f"Arivu MCP: connecting to {dialect} database...")
        db = Arivu.connect(**connect_kwargs)
        logger.info("Arivu MCP: connected.")
    except ArivuError as exc:
        logger.error(f"Arivu MCP: connection failed — {exc}")
        raise
    except Exception as exc:
        logger.error(f"Arivu MCP: unexpected startup error — {exc}")
        raise RuntimeError(f"Failed to initialize Arivu MCP: {exc}") from exc

    try:
        yield {"db": db}
    finally:
        try:
            db.close()
            logger.info("Arivu MCP: connection closed.")
        except Exception as exc:
            logger.warning(f"Arivu MCP: error during shutdown — {exc}")


mcp = FastMCP("arivu_mcp", lifespan=lifespan)


# ─────────────────────────────────────────────────────────────────────────────
# Input models
# ─────────────────────────────────────────────────────────────────────────────

class QueryInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    question: str = Field(
        ...,
        description="Natural language question about your database. "
                    "Example: 'How many users signed up this week?'",
        min_length=3,
        max_length=1000,
    )
    user_id: str = Field(
        default="mcp_user",
        description="User identifier for session tracking.",
    )


class SessionInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    session_id: str = Field(
        ...,
        description="Session ID returned in a previous arivu_query response "
                    "when pending_approval was true.",
        min_length=1,
    )
    user_id: str = Field(
        default="mcp_admin",
        description="Admin user identifier.",
    )


class SessionHistoryInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    session_id: str = Field(
        ...,
        description=(
            "Session ID to fetch history for. "
            "Format: mcp:mcp_user for MCP sessions, "
            "restintegration:rest_user for REST sessions."
        ),
        min_length=1,
    )
    limit: int = Field(
        default=10,
        description="Max number of past turns to return.",
        ge=1,
        le=50,
    )


class ExecuteSQLInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    sql: str = Field(
        ...,
        description="Raw SQL statement to execute.",
        min_length=1,
        max_length=50_000,
    )
    max_rows: int = Field(
        default=100,
        description="Maximum number of rows to return.",
        ge=1,
        le=1000,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tools
# ─────────────────────────────────────────────────────────────────────────────

@mcp.tool(name="arivu_query")
async def arivu_query(params: QueryInput, ctx: Context) -> str:
    """
    Ask your database a question in plain English.

    Runs the full Arivu pipeline:
      1. Generates SQL from your question
      2. Verifies it's safe to run
      3. Executes it against your DB
      4. Returns a natural language answer

    If the query is destructive (UPDATE/DELETE/DROP etc.) and the DB is in
    admin mode, it will NOT execute automatically — it returns
    pending_approval=true with a session_id. Call arivu_approve to run it.

    Args:
        params (QueryInput):
            - question (str): Natural language question
            - user_id  (str): User identifier (default: mcp_user)

    Returns:
        str: JSON with keys:
            - response        (str)  — natural language answer
            - sql             (str)  — SQL that was generated
            - success         (bool) — whether pipeline succeeded
            - pending_approval(bool) — true if admin approval needed
            - session_id      (str)  — use this to approve/reject
            - error           (str|null)
    """
    db = ctx.request_context.lifespan_state["db"]

    from arivu.pipeline.runner import run_pipeline_async

    await ctx.report_progress(0.1, "Running pipeline...")

    pipeline_input = db.query(params.question)
    pipeline_input["session_id"] = f"mcp:{params.user_id}"

    result = await run_pipeline_async(pipeline_input)

    await ctx.report_progress(1.0, "Done.")

    return json.dumps({
        "response":         result.response,
        "sql":              result.sql,
        "success":          result.success,
        "pending_approval": result.pending_approval,
        "session_id":       result.session_id,
        "error":            result.error,
    }, indent=2)


@mcp.tool(name="arivu_approve")
async def arivu_approve(params: SessionInput, ctx: Context) -> str:
    """
    Approve and execute a destructive SQL operation that was held for review.

    Use this ONLY after reviewing the SQL shown in the arivu_query response.
    The SQL is executed immediately and cannot be undone.

    Args:
        params (SessionInput):
            - session_id (str): From the pending arivu_query response
            - user_id    (str): Admin identifier

    Returns:
        str: JSON with keys:
            - status       (str)  — "approved" or "error"
            - rows_affected(int)  — number of rows changed
            - sql          (str)  — the SQL that was executed
            - message      (str)  — human readable confirmation
    """
    db = ctx.request_context.lifespan_state["db"]

    from arivu.memory.store import get_pending_approval, resolve_approval
    from sqlalchemy import text

    pending = get_pending_approval(params.session_id)
    if not pending:
        return json.dumps({
            "status":  "error",
            "message": f"No pending approval found for session: {params.session_id}. "
                       "It may have already been approved/rejected or expired.",
        })

    resolve_approval(params.session_id, approved=True)

    try:
        with db._engine.connect() as conn:
            result = conn.execute(text(pending["sql"]))
            conn.commit()
            affected = result.rowcount if result.rowcount is not None else 0

        logger.info(f"[arivu_mcp] approved  session={params.session_id}  rows={affected}")
        return json.dumps({
            "status":        "approved",
            "rows_affected": affected,
            "sql":           pending["sql"],
            "message":       f"Executed successfully. {affected} row(s) affected.",
        }, indent=2)

    except Exception as exc:
        logger.error(f"[arivu_mcp] approve execution failed: {exc}")
        return json.dumps({
            "status":  "error",
            "message": f"Approval granted but execution failed: {exc}",
            "sql":     pending["sql"],
        }, indent=2)


@mcp.tool(name="arivu_reject")
async def arivu_reject(params: SessionInput, ctx: Context) -> str:
    """
    Reject and cancel a destructive SQL operation that was held for review.

    Nothing is changed in the database. The pending operation is discarded.

    Args:
        params (SessionInput):
            - session_id (str): From the pending arivu_query response
            - user_id    (str): Admin identifier

    Returns:
        str: JSON with keys:
            - status  (str) — "rejected" or "error"
            - message (str) — confirmation
    """
    from arivu.memory.store import get_pending_approval, resolve_approval

    pending = get_pending_approval(params.session_id)
    if not pending:
        return json.dumps({
            "status":  "error",
            "message": f"No pending approval found for session: {params.session_id}.",
        })

    resolve_approval(params.session_id, approved=False)
    logger.info(f"[arivu_mcp] rejected  session={params.session_id}")

    return json.dumps({
        "status":  "rejected",
        "message": "Operation cancelled. Nothing was changed in the database.",
    }, indent=2)


@mcp.tool(name="arivu_refresh_schema")
async def arivu_refresh_schema(ctx: Context) -> str:
    """
    Force a fresh read of the database schema.

    Call this after running migrations, adding tables, or changing columns.
    The schema is automatically refreshed based on TTL — this bypasses that.

    Returns:
        str: JSON with keys:
            - status  (str) — "ok"
            - tables  (int) — number of tables found
            - message (str) — confirmation
    """
    db = ctx.request_context.lifespan_state["db"]

    db.refresh_schema()
    table_count = len(db._schema_cache.raw_schema or [])

    logger.info(f"[arivu_mcp] schema refreshed  tables={table_count}")
    return json.dumps({
        "status":  "ok",
        "tables":  table_count,
        "message": f"Schema refreshed. {table_count} table(s) loaded.",
    }, indent=2)


@mcp.tool(name="arivu_get_schema")
async def arivu_get_schema(ctx: Context) -> str:
    """
    Get the current database schema — tables, columns, types, and foreign keys.

    Useful for understanding what data is available before asking questions.

    Returns:
        str: JSON with keys:
            - tables (list) — each item has:
                - name    (str)  — table name
                - columns (list) — each with name, type, nullable, primary_key
                - foreign_keys (list) — each with column, ref_table, ref_column
            - schema_age_seconds (float) — how old the cached schema is
    """
    db = ctx.request_context.lifespan_state["db"]

    raw = db._schema_cache.raw_schema or []
    tables = [
        {
            "name":         t["table"],
            "columns":      t["columns"],
            "foreign_keys": t["foreign_keys"],
        }
        for t in raw
    ]

    return json.dumps({
        "tables":             tables,
        "schema_age_seconds": round(db.schema_age_seconds or 0, 1),
    }, indent=2)


@mcp.tool(name="arivu_test_connection")
async def arivu_test_connection(ctx: Context) -> str:
    """
    Run a health check on the database connection.

    Checks three things:
      1. Can we reach the DB at all (ping)
      2. Can we read the schema (tables accessible)
      3. Can we run a simple SELECT (query works)

    Returns:
        str: JSON with keys:
            - status        (str)  — "ok" or "error"
            - ping          (bool) — DB is reachable
            - schema_loaded (bool) — schema extracted successfully
            - query_works   (bool) — SELECT 1 executed successfully
            - tables        (int)  — number of tables found
            - dialect       (str)  — which dialect is configured
            - mode          (str)  — current connection mode
            - latency_ms    (float)— round-trip time for the probe query
            - error         (str|null) — error message if anything failed
    """
    import time
    from sqlalchemy import text

    db = ctx.request_context.lifespan_state["db"]

    result = {
        "status":        "ok",
        "ping":          False,
        "schema_loaded": False,
        "query_works":   False,
        "tables":        0,
        "dialect":       db._dialect,
        "mode":          db.mode,
        "latency_ms":    None,
        "error":         None,
    }

    # ── Check 1: ping the DB ──────────────────────────────────────────
    try:
        t0 = time.perf_counter()
        with db._engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        result["latency_ms"] = round((time.perf_counter() - t0) * 1000, 2)
        result["ping"] = True
        result["query_works"] = True
    except Exception as exc:
        result["status"] = "error"
        result["error"]  = f"DB unreachable: {exc}"
        return json.dumps(result, indent=2)

    # ── Check 2: schema loaded ────────────────────────────────────────
    try:
        raw = db._schema_cache.raw_schema or []
        if raw:
            result["schema_loaded"] = True
            result["tables"]        = len(raw)
        else:
            db.refresh_schema()
            raw = db._schema_cache.raw_schema or []
            result["schema_loaded"] = True
            result["tables"]        = len(raw)
    except Exception as exc:
        result["status"] = "error"
        result["error"]  = f"Schema extraction failed: {exc}"
        return json.dumps(result, indent=2)

    logger.info(
        f"[arivu_mcp] connection test passed  "
        f"tables={result['tables']}  latency={result['latency_ms']}ms"
    )
    return json.dumps(result, indent=2)


@mcp.tool(name="arivu_get_pending_approvals")
async def arivu_get_pending_approvals(ctx: Context) -> str:
    """
    List all destructive SQL operations currently waiting for approval.

    Use this to see what is queued before calling arivu_approve or
    arivu_reject.

    Returns:
        str: JSON with keys:
            - count   (int)  - number of pending approvals
            - pending (list) - each item has:
                - session_id (str) - pass this to arivu_approve/arivu_reject
                - sql        (str) - the SQL waiting to be executed
                - question   (str) - the original NL question that generated it
    """
    from arivu.memory.store import get_all_pending_approvals

    try:
        pending = get_all_pending_approvals()
    except Exception as exc:
        return json.dumps({
            "count":   0,
            "pending": [],
            "error":   f"Could not load pending approvals: {exc}",
        }, indent=2)

    return json.dumps({
        "count":   len(pending),
        "pending": [
            {
                "session_id": p["session_id"],
                "sql":        p["sql"],
                "question":   p.get("question", ""),
            }
            for p in pending
        ],
    }, indent=2)


@mcp.tool(name="arivu_get_session_history")
async def arivu_get_session_history(params: SessionHistoryInput, ctx: Context) -> str:
    """
    Retrieve past questions, SQL, and responses for a session.

    Useful for auditing what was asked, reviewing generated SQL,
    or understanding the context of a previous conversation.

    Args:
        params (SessionHistoryInput):
            - session_id (str): Session to look up
            - limit      (int): Max turns to return (default 10, max 50)

    Returns:
        str: JSON with keys:
            - session_id (str)  - the session that was queried
            - count      (int)  - number of turns returned
            - history    (list) - each item has:
                - question  (str) - the NL question asked
                - sql       (str) - SQL that was generated
                - response  (str) - the answer that was returned
    """
    from arivu.memory.store import load_session_history

    try:
        history = load_session_history(params.session_id, limit=params.limit)
    except Exception as exc:
        return json.dumps({
            "session_id": params.session_id,
            "count":      0,
            "history":    [],
            "error":      f"Could not load history: {exc}",
        }, indent=2)

    return json.dumps({
        "session_id": params.session_id,
        "count":      len(history),
        "history": [
            {
                "question": h.get("question", ""),
                "sql":      h.get("sql", ""),
                "response": h.get("response", ""),
            }
            for h in history
        ],
    }, indent=2)


@mcp.tool(name="arivu_list_dialects")
async def arivu_list_dialects(ctx: Context) -> str:
    """
    List all supported database dialects and whether their drivers are installed.

    Returns:
        str: JSON with keys per dialect:
            - installed   (bool) — True if the driver package is available
            - pip_install (str)  — pip install command if not installed
            - probe_sql   (str)  — the SQL used to test connectivity
    """
    from arivu.connection.auth import list_dialects
    return json.dumps(list_dialects(), indent=2)


@mcp.tool(name="arivu_execute_sql")
async def arivu_execute_sql(params: ExecuteSQLInput, ctx: Context) -> str:
    """
    Execute raw SQL directly against the database.

    WARNING: This bypasses the Arivu safety pipeline. Destructive operations
    (DROP, DELETE, TRUNCATE) will execute immediately without approval.
    Use arivu_query for safe, LLM-mediated access instead.

    Args:
        params (ExecuteSQLInput):
            - sql      (str): Raw SQL to execute
            - max_rows (int): Max rows to return (default 100, max 1000)

    Returns:
        str: JSON with keys:
            - columns (list) — column names
            - rows    (list) — result rows (truncated to max_rows)
            - row_count (int) — total rows returned
            - truncated (bool) — whether results were clipped
    """
    from sqlalchemy import text

    db = ctx.request_context.lifespan_state["db"]

    try:
        with db._engine.connect() as conn:
            result = conn.execute(text(params.sql))

            if result.returns_rows:
                columns = list(result.keys())
                all_rows = [dict(row) for row in result]
                truncated = len(all_rows) > params.max_rows
                rows = all_rows[:params.max_rows]
                return json.dumps({
                    "columns": columns,
                    "rows": rows,
                    "row_count": len(rows),
                    "truncated": truncated,
                }, indent=2, default=str)
            else:
                conn.commit()
                affected = result.rowcount if result.rowcount is not None else 0
                return json.dumps({
                    "status": "executed",
                    "rows_affected": affected,
                    "message": f"Statement executed. {affected} row(s) affected.",
                }, indent=2)

    except Exception as exc:
        return json.dumps({
            "status": "error",
            "message": str(exc),
            "sql": params.sql,
        }, indent=2)


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main():
    """
    CLI entry point for the MCP server.

    Supports two transports:
      --transport stdio  (default) — for local MCP clients like Claude Desktop
      --transport http   — for remote/deployable Streamable HTTP transport
      --port 8080        — port for HTTP transport (default: 8080)
      --host 0.0.0.0     — bind address for HTTP transport (default: 0.0.0.0)
    """
    import argparse

    parser = argparse.ArgumentParser(description="Arivu MCP Server")
    parser.add_argument(
        "--transport", choices=["stdio", "http"], default="stdio",
        help="MCP transport to use (default: stdio)"
    )
    parser.add_argument(
        "--port", type=int, default=8080,
        help="Port for HTTP transport (default: 8080)"
    )
    parser.add_argument(
        "--host", type=str, default="0.0.0.0",
        help="Bind address for HTTP transport (default: 0.0.0.0)"
    )
    args = parser.parse_args()

    if args.transport == "http":
        logger.info(f"Starting Arivu MCP server (Streamable HTTP) on {args.host}:{args.port}")
        mcp.run(transport="streamable-http", host=args.host, port=args.port)
    else:
        logger.info("Starting Arivu MCP server (stdio)")
        mcp.run()  # stdio transport — works with Claude Desktop out of the box


if __name__ == "__main__":
    main()
