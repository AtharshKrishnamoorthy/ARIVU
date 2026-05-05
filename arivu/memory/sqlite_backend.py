"""
arivu.memory.sqlite_backend
───────────────────────────────────
SQLite memory backend.

Zero infra — just a local file at ~/.arivu/memory.db by default.
All tables are created on first use via _ensure_schema().

Schema:
    interactions      — NL → SQL → response history per session
    trace_events      — per-node timing events from every pipeline run
    pending_approvals — destructive SQL awaiting admin sign-off
    rlhf_signals      — thumbs up/down + admin approval/rejection log
    error_events      — error boundary captures with full trace context
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import time
from contextlib import contextmanager
from typing import Optional

from .backend import BaseMemoryBackend

logger = logging.getLogger("arivu.memory.sqlite")

# Number of history turns to return per session — keep small to avoid LLM token bloat
HISTORY_WINDOW = 3


class SQLiteMemoryBackend(BaseMemoryBackend):

    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self._ensure_schema()
        logger.info(f"SQLite backend initialised at {db_path}")

    # ─────────────────────────────────────────
    # Context manager for connections
    # ─────────────────────────────────────────

    @contextmanager
    def _conn(self):
        # We increase timeout to 15.0 to handle concurrent locks
        conn = sqlite3.connect(self.db_path, timeout=15.0)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA journal_mode=WAL")   # safe concurrent writes
        except sqlite3.OperationalError as e:
            logger.warning(f"[sqlite] WAL mode failed, trying without: {e}")
            pass
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA synchronous=NORMAL")
        
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    # ─────────────────────────────────────────
    # Schema bootstrap
    # ─────────────────────────────────────────

    def _ensure_schema(self) -> None:
        with self._conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS interactions (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id  TEXT    NOT NULL,
                    question    TEXT    NOT NULL,
                    sql         TEXT    NOT NULL,
                    response    TEXT    NOT NULL,
                    ts          REAL    NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_interactions_session
                    ON interactions(session_id, ts DESC);

                CREATE TABLE IF NOT EXISTS trace_events (
                    id             INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id     TEXT    NOT NULL,
                    interaction_id INTEGER,
                    events_json    TEXT    NOT NULL,
                    ts             REAL    NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_trace_session
                    ON trace_events(session_id, ts DESC);

                CREATE TABLE IF NOT EXISTS pending_approvals (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id  TEXT    NOT NULL UNIQUE,
                    question    TEXT    NOT NULL,
                    sql         TEXT    NOT NULL,
                    resolved    INTEGER NOT NULL DEFAULT 0,
                    approved    INTEGER,
                    ts          REAL    NOT NULL
                );

                CREATE TABLE IF NOT EXISTS rlhf_signals (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id  TEXT    NOT NULL,
                    question    TEXT    NOT NULL,
                    sql         TEXT    NOT NULL,
                    signal      TEXT    NOT NULL,
                    approved    INTEGER,
                    ts          REAL    NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_rlhf_ts
                    ON rlhf_signals(ts DESC);

                CREATE TABLE IF NOT EXISTS error_events (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id  TEXT    NOT NULL,
                    error       TEXT    NOT NULL,
                    error_node  TEXT    NOT NULL,
                    error_type  TEXT    NOT NULL,
                    question    TEXT    NOT NULL,
                    sql         TEXT    NOT NULL,
                    trace_json  TEXT    NOT NULL,
                    ts          REAL    NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_error_ts
                    ON error_events(ts DESC);

                CREATE TABLE IF NOT EXISTS config (
                    key   TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS dashboards (
                    id         TEXT PRIMARY KEY,
                    name       TEXT NOT NULL,
                    layout     TEXT,
                    created_at REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS dashboard_widgets (
                    id           TEXT PRIMARY KEY,
                    dashboard_id TEXT NOT NULL,
                    title        TEXT NOT NULL,
                    query        TEXT NOT NULL,
                    sql          TEXT NOT NULL,
                    data_json    TEXT NOT NULL,
                    c1_html      TEXT NOT NULL,
                    position     TEXT,
                    created_at   REAL NOT NULL,
                    FOREIGN KEY(dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
                );
            """)
            
            # Non-destructive schema upgrades
            tables_to_upgrade = ["interactions", "trace_events", "pending_approvals", "rlhf_signals", "error_events"]
            for tbl in tables_to_upgrade:
                try:
                    conn.execute(f"ALTER TABLE {tbl} ADD COLUMN dialect TEXT DEFAULT ''")
                except sqlite3.OperationalError:
                    pass
                try:
                    conn.execute(f"ALTER TABLE {tbl} ADD COLUMN interface TEXT DEFAULT 'dashboard'")
                except sqlite3.OperationalError:
                    pass

    # ─────────────────────────────────────────
    # Session history
    # ─────────────────────────────────────────

    def load_session_history(self, session_id: str, limit: int = 3) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT question, sql, response, ts
                FROM   interactions
                WHERE  session_id = ?
                ORDER  BY ts DESC
                LIMIT  ?
                """,
                (session_id, limit),
            ).fetchall()
        # Return oldest-first so the LLM reads conversation in order
        return [dict(r) for r in reversed(rows)]

    def save_interaction(
        self,
        session_id: str,
        question: str,
        sql: str,
        response: str,
        trace_events: list[dict],
        dialect: str = "",
        interface: str = "dashboard",
    ) -> None:
        ts = time.time()
        with self._conn() as conn:
            cur = conn.execute(
                """
                INSERT INTO interactions (session_id, question, sql, response, dialect, interface, ts)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (session_id, question, sql, response, dialect, interface, ts),
            )
            interaction_id = cur.lastrowid
            conn.execute(
                """
                INSERT INTO trace_events (session_id, interaction_id, events_json, ts)
                VALUES (?, ?, ?, ?)
                """,
                (session_id, interaction_id, json.dumps(trace_events), ts),
            )

    # ─────────────────────────────────────────
    # Admin approval
    # ─────────────────────────────────────────

    def save_pending_approval(
        self,
        session_id: str,
        sql: str,
        question: str,
    ) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO pending_approvals (session_id, question, sql, ts)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                    question = excluded.question,
                    sql      = excluded.sql,
                    ts       = excluded.ts,
                    resolved = 0,
                    approved = NULL
                """,
                (session_id, question, sql, time.time()),
            )

    def get_pending_approval(self, session_id: str) -> Optional[dict]:
        with self._conn() as conn:
            row = conn.execute(
                """
                SELECT session_id, question, sql, resolved, approved, ts
                FROM   pending_approvals
                WHERE  session_id = ? AND resolved = 0
                """,
                (session_id,),
            ).fetchone()
        if row is None:
            return None
        d = dict(row)
        d["approved"] = bool(d["approved"]) if d["approved"] is not None else None
        d["resolved"] = bool(d["resolved"])
        return d

    def resolve_approval(self, session_id: str, approved: bool) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                UPDATE pending_approvals
                SET    resolved = 1, approved = ?
                WHERE  session_id = ?
                """,
                (int(approved), session_id),
            )

    # ─────────────────────────────────────────
    # RLHF
    # ─────────────────────────────────────────

    def save_rlhf_signal(
        self,
        session_id: str,
        question: str,
        sql: str,
        signal: str,
        approved: Optional[bool],
        dialect: str = "",
        interface: str = "dashboard",
    ) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO rlhf_signals (session_id, question, sql, signal, approved, dialect, interface, ts)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    question,
                    sql,
                    signal,
                    int(approved) if approved is not None else None,
                    dialect,
                    interface,
                    time.time(),
                ),
            )

    def get_rlhf_log(
        self,
        limit: int = 100,
        signal_filter: Optional[str] = None,
    ) -> list[dict]:
        with self._conn() as conn:
            if signal_filter:
                rows = conn.execute(
                    """
                    SELECT session_id, question, sql, signal, approved, dialect, interface, ts
                    FROM   rlhf_signals
                    WHERE  signal = ?
                    ORDER  BY ts DESC
                    LIMIT  ?
                    """,
                    (signal_filter, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT session_id, question, sql, signal, approved, dialect, interface, ts
                    FROM   rlhf_signals
                    ORDER  BY ts DESC
                    LIMIT  ?
                    """,
                    (limit,),
                ).fetchall()

        result = []
        for r in rows:
            d = dict(r)
            d["approved"] = bool(d["approved"]) if d["approved"] is not None else None
            d["dialect"] = d.get("dialect", "")
            d["interface"] = d.get("interface", "dashboard")
            result.append(d)
        return result

    # ─────────────────────────────────────────
    # Error events
    # ─────────────────────────────────────────

    def save_error_event(
        self,
        session_id: str,
        error: str,
        error_node: str,
        error_type: str,
        question: str,
        sql: str,
        trace_events: list[dict],
        dialect: str = "",
        connection_meta: dict = None,
        interface: str = "dashboard",
    ) -> None:
        # Inject dialect metadata into trace events for persistence
        enriched_events = list(trace_events)
        if dialect or connection_meta:
            enriched_events.insert(0, {
                "node": "__meta__",
                "status": "ok",
                "latency_ms": 0,
                "dialect": dialect,
                "connection_meta": connection_meta or {},
            })
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO error_events
                    (session_id, error, error_node, error_type, question, sql, trace_json, dialect, interface, ts)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    error,
                    error_node,
                    error_type,
                    question,
                    sql,
                    json.dumps(enriched_events),
                    dialect,
                    interface,
                    time.time()
                ),
            )

    def get_error_log(self, limit: int = 100) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT session_id, error, error_node, error_type, question, sql, trace_json, ts
                FROM   error_events
                ORDER  BY ts DESC
                LIMIT  ?
                """,
                (limit,),
            ).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            # Extract dialect metadata from trace_json if present
            trace_json = d.pop("trace_json", None)
            meta = {}
            if trace_json:
                try:
                    events = json.loads(trace_json)
                    for ev in events:
                        if ev.get("node") == "__meta__":
                            meta = ev
                            break
                except Exception:
                    pass
            d["dialect"] = meta.get("dialect", "")
            d["connection_meta"] = meta.get("connection_meta", {})
            result.append(d)
        return result

    # ─────────────────────────────────────────
    # Dashboard queries
    # ─────────────────────────────────────────

    def get_pipeline_traces(
        self,
        session_id: Optional[str] = None,
        limit: int = 50,
    ) -> list[dict]:
        with self._conn() as conn:
            if session_id:
                rows = conn.execute(
                    """
                    SELECT te.session_id, te.events_json, te.ts,
                           i.question, i.sql
                    FROM   trace_events te
                    JOIN   interactions i ON i.id = te.interaction_id
                    WHERE  te.session_id = ?
                    ORDER  BY te.ts DESC
                    LIMIT  ?
                    """,
                    (session_id, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT te.session_id, te.events_json, te.ts,
                           i.question, i.sql
                    FROM   trace_events te
                    JOIN   interactions i ON i.id = te.interaction_id
                    ORDER  BY te.ts DESC
                    LIMIT  ?
                    """,
                    (limit,),
                ).fetchall()

        result = []
        for r in rows:
            d = dict(r)
            events = json.loads(d.pop("events_json"))
            # Extract dialect metadata from __meta__ event if present
            meta = {}
            real_events = []
            for ev in events:
                if ev.get("node") == "__meta__":
                    meta = ev
                else:
                    real_events.append(ev)
            d["events"] = real_events
            d["dialect"] = meta.get("dialect", "")
            d["connection_meta"] = meta.get("connection_meta", {})
            result.append(d)
        return result

    def get_session_list(self, limit: int = 50) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT
                    i.session_id,
                    COUNT(i.id)                             AS query_count,
                    MAX(i.question)                         AS last_question,
                    MAX(i.ts)                               AS last_ts,
                    MAX(i.dialect)                          AS dialect,
                    MAX(i.interface)                        AS interface,
                    COALESCE(e.error_count, 0)              AS error_count
                FROM interactions i
                LEFT JOIN (
                    SELECT session_id, COUNT(*) AS error_count
                    FROM   error_events
                    GROUP  BY session_id
                ) e ON e.session_id = i.session_id
                GROUP  BY i.session_id
                ORDER  BY last_ts DESC
                LIMIT  ?
                """,
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]

    def get_dashboard_stats(self) -> dict:
        with self._conn() as conn:
            # 1. Sessions and Queries
            counts = conn.execute(
                "SELECT COUNT(DISTINCT session_id) as total_sessions, COUNT(id) as total_queries FROM interactions"
            ).fetchone()
            total_sessions = counts["total_sessions"] or 0
            total_queries = counts["total_queries"] or 0

            # 2. Errors
            err_counts = conn.execute("SELECT COUNT(id) as total_errors FROM error_events").fetchone()
            total_errors = err_counts["total_errors"] or 0

            # 3. RLHF
            rlhf_pos = conn.execute("SELECT COUNT(id) as count FROM rlhf_signals WHERE signal='positive'").fetchone()["count"] or 0
            rlhf_neg = conn.execute("SELECT COUNT(id) as count FROM rlhf_signals WHERE signal='negative'").fetchone()["count"] or 0

            # For node_avg_latency and avg_latency_ms, we do a basic extraction. 
            # SQLite json1 extension can do this, but for simplicity/safety across versions, 
            # we pull recent traces and calculate in mem, just limiting the payload.
            traces = conn.execute("SELECT events_json FROM trace_events ORDER BY ts DESC LIMIT 200").fetchall()
            latencies = []
            from collections import defaultdict
            node_latencies = defaultdict(list)

            for row in traces:
                events = json.loads(row["events_json"])
                total_ms = 0
                for ev in events:
                    if "latency_ms" in ev:
                        lat = ev["latency_ms"]
                        total_ms += lat
                        node_latencies[ev.get("node", "unknown")].append(lat)
                if total_ms > 0:
                    latencies.append(total_ms)

            avg_latency = (sum(latencies) / len(latencies)) if latencies else 0.0
            node_avg = {node: round(sum(vals) / len(vals), 1) for node, vals in node_latencies.items() if vals}

            return {
                "total_sessions": total_sessions,
                "total_queries": total_queries,
                "total_errors": total_errors,
                "error_rate": round(total_errors / max(total_queries, 1) * 100, 1),
                "positive_rlhf": rlhf_pos,
                "negative_rlhf": rlhf_neg,
                "avg_latency_ms": round(avg_latency, 1),
                "node_avg_latency": node_avg,
            }

    # ─────────────────────────────────────────
    # Config (KV Store)
    # ─────────────────────────────────────────

    def save_config(self, key: str, value: dict) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO config (key, value)
                VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """,
                (key, json.dumps(value))
            )

    def get_config(self, key: str) -> Optional[dict]:
        with self._conn() as conn:
            row = conn.execute("SELECT value FROM config WHERE key = ?", (key,)).fetchone()
            if row:
                return json.loads(row["value"])
            return None

    def get_configs_by_prefix(self, prefix: str) -> dict[str, dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT key, value FROM config WHERE key LIKE ?",
                (f"{prefix}%",)
            ).fetchall()
            return {r["key"][len(prefix):]: json.loads(r["value"]) for r in rows}