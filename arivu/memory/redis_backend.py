"""
arivu.memory.redis_backend
──────────────────────────────────
Redis memory backend.

For production / multi-instance deployments where multiple ARIVU
processes share the same memory store.

Key layout (all keys prefixed with "dh:"):
    dh:databases                         — JSON: {alias: {dialect, display_name, created_at}}
    dh:session:{session_id}:history      — List of interaction JSON blobs
    dh:session:{session_id}:traces       — List of trace event JSON blobs
    dh:approval:{session_id}             — Hash: pending approval record
    dh:rlhf                              — Sorted set by timestamp, value=JSON
    dh:errors                            — Sorted set by timestamp, value=JSON
    dh:sessions                          — Sorted set: session_id → last_ts

Requires: pip install redis
Set ARIVU_REDIS_URL env var (default: redis://localhost:6379/0)
"""

from __future__ import annotations

import json
import logging
import time
from typing import Optional

from .backend import BaseMemoryBackend

logger = logging.getLogger("arivu.memory.redis")

HISTORY_WINDOW   = 3      # max history turns injected into the LLM prompt
KEY_PREFIX       = "dh:"
SESSION_TTL      = 86400 * 7   # 7 days — sessions expire after inactivity


class RedisMemoryBackend(BaseMemoryBackend):

    def __init__(self, redis_url: str) -> None:
        try:
            import redis
            self._r = redis.from_url(redis_url, decode_responses=True)
            self._r.ping()
            logger.info(f"Redis backend connected: {redis_url}")
        except ImportError as exc:
            raise ImportError(
                "redis is required for the Redis memory backend. "
                "Install it with: pip install redis"
            ) from exc
        except Exception as exc:
            raise ConnectionError(
                f"Could not connect to Redis at {redis_url}: {exc}"
            ) from exc

        self._migrate_connections_registry()

    # ─────────────────────────────────────────
    # Key helpers
    # ─────────────────────────────────────────

    @staticmethod
    def _hkey(session_id: str, db_alias: str = "") -> str:
        prefix = f"{KEY_PREFIX}db:{db_alias}:" if db_alias else KEY_PREFIX
        return f"{prefix}session:{session_id}:history"

    @staticmethod
    def _tkey(session_id: str, db_alias: str = "") -> str:
        prefix = f"{KEY_PREFIX}db:{db_alias}:" if db_alias else KEY_PREFIX
        return f"{prefix}session:{session_id}:traces"

    @staticmethod
    def _akey(session_id: str, db_alias: str = "") -> str:
        prefix = f"{KEY_PREFIX}db:{db_alias}:" if db_alias else KEY_PREFIX
        return f"{prefix}approval:{session_id}"

    @staticmethod
    def _sessions_key(db_alias: str = "") -> str:
        prefix = f"{KEY_PREFIX}db:{db_alias}:" if db_alias else KEY_PREFIX
        return f"{prefix}sessions"

    @staticmethod
    def _rlhf_key(db_alias: str = "") -> str:
        prefix = f"{KEY_PREFIX}db:{db_alias}:" if db_alias else KEY_PREFIX
        return f"{prefix}rlhf"

    @staticmethod
    def _errors_key(db_alias: str = "") -> str:
        prefix = f"{KEY_PREFIX}db:{db_alias}:" if db_alias else KEY_PREFIX
        return f"{prefix}errors"

    @staticmethod
    def _saved_queries_key(db_alias: str = "") -> str:
        prefix = f"{KEY_PREFIX}db:{db_alias}:" if db_alias else KEY_PREFIX
        return f"{prefix}saved_queries"

    # ─────────────────────────────────────────
    # Session history
    # ─────────────────────────────────────────

    def load_session_history(self, session_id: str, limit: int = 3, db_alias: str = "") -> list[dict]:
        key = self._hkey(session_id, db_alias)
        raw = self._r.lrange(key, -limit, -1)
        return [json.loads(r) for r in raw]

    def save_interaction(
        self,
        session_id: str,
        question: str,
        sql: str,
        response: str,
        trace_events: list[dict],
        db_alias: str = "",
        dialect: str = "",
        interface: str = "dashboard",
    ) -> None:
        ts = time.time()
        entry = json.dumps({
            "question": question,
            "sql": sql,
            "response": response,
            "ts": ts,
        })
        pipe = self._r.pipeline()

        hkey = self._hkey(session_id, db_alias)
        pipe.rpush(hkey, entry)
        pipe.expire(hkey, SESSION_TTL)

        tkey = self._tkey(session_id, db_alias)
        trace_blob = json.dumps({
            "session_id": session_id,
            "question": question,
            "sql": sql,
            "events": trace_events,
            "ts": ts,
        })
        pipe.rpush(tkey, trace_blob)
        pipe.expire(tkey, SESSION_TTL)

        pipe.zadd(self._sessions_key(db_alias), {session_id: ts})

        pipe.execute()

    # ─────────────────────────────────────────
    # Admin approval
    # ─────────────────────────────────────────

    def save_pending_approval(
        self,
        session_id: str,
        sql: str,
        question: str,
        db_alias: str = "",
    ) -> None:
        key = self._akey(session_id, db_alias)
        self._r.hset(key, mapping={
            "session_id": session_id,
            "sql": sql,
            "question": question,
            "resolved": "0",
            "approved": "",
            "ts": str(time.time()),
        })
        self._r.expire(key, SESSION_TTL)

    def get_pending_approval(self, session_id: str, db_alias: str = "") -> Optional[dict]:
        key = self._akey(session_id, db_alias)
        data = self._r.hgetall(key)
        if not data or data.get("resolved") == "1":
            return None
        return {
            "session_id": data["session_id"],
            "sql": data["sql"],
            "question": data["question"],
            "resolved": data["resolved"] == "1",
            "approved": (
                None if data["approved"] == ""
                else data["approved"] == "1"
            ),
            "ts": float(data["ts"]),
        }

    def resolve_approval(self, session_id: str, approved: bool, db_alias: str = "") -> None:
        key = self._akey(session_id, db_alias)
        self._r.hset(key, mapping={
            "resolved": "1",
            "approved": "1" if approved else "0",
        })

    def get_all_pending_approvals(self, db_alias: str = "") -> list[dict]:
        result = []
        pattern = f"arivu:approval:{db_alias}:*" if db_alias else "arivu:approval:*"
        for key in self._r.scan_iter(match=pattern, count=100):
            data = self._r.hgetall(key)
            if not data or data.get("resolved") == "1":
                continue
            result.append({
                "session_id": data.get("session_id", ""),
                "sql": data.get("sql", ""),
                "question": data.get("question", ""),
                "db_alias": data.get("db_alias", ""),
                "resolved": False,
                "approved": (
                    None if data.get("approved", "") == ""
                    else data["approved"] == "1"
                ),
                "ts": float(data.get("ts", 0)),
            })
        result.sort(key=lambda x: x["ts"], reverse=True)
        return result

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
        db_alias: str = "",
        dialect: str = "",
        interface: str = "dashboard",
    ) -> None:
        ts = time.time()
        blob = json.dumps({
            "session_id": session_id,
            "question": question,
            "sql": sql,
            "signal": signal,
            "approved": approved,
            "dialect": dialect,
            "interface": interface,
            "ts": ts,
        })
        self._r.zadd(self._rlhf_key(db_alias), {blob: ts})

    def get_rlhf_log(
        self,
        limit: int = 100,
        signal_filter: Optional[str] = None,
        db_alias: str = "",
    ) -> list[dict]:
        raw = self._r.zrevrange(self._rlhf_key(db_alias), 0, limit * 3 - 1)
        entries = [json.loads(r) for r in raw]
        if signal_filter:
            entries = [e for e in entries if e.get("signal") == signal_filter]
        return entries[:limit]

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
        db_alias: str = "",
        dialect: str = "",
        connection_meta: dict = None,
        interface: str = "dashboard",
    ) -> None:
        ts = time.time()
        blob = json.dumps({
            "session_id": session_id,
            "error": error,
            "error_node": error_node,
            "error_type": error_type,
            "question": question,
            "sql": sql,
            "trace_events": trace_events,
            "db_alias": db_alias,
            "dialect": dialect,
            "connection_meta": connection_meta or {},
            "interface": interface,
            "ts": ts,
        })
        self._r.zadd(self._errors_key(db_alias), {blob: ts})

    def get_error_log(self, limit: int = 100, db_alias: str = "") -> list[dict]:
        raw = self._r.zrevrange(self._errors_key(db_alias), 0, limit - 1)
        result = []
        for r in raw:
            d = json.loads(r)
            d.pop("trace_events", None)
            d.setdefault("dialect", "")
            d.setdefault("connection_meta", {})
            result.append(d)
        return result

    # ─────────────────────────────────────────
    # Dashboard queries
    # ─────────────────────────────────────────

    def get_pipeline_traces(
        self,
        session_id: Optional[str] = None,
        limit: int = 50,
        db_alias: str = "",
    ) -> list[dict]:
        if session_id:
            key = self._tkey(session_id, db_alias)
            raw = self._r.lrange(key, -limit, -1)
            return [json.loads(r) for r in reversed(raw)]
        else:
            session_ids = self._r.zrevrange(self._sessions_key(db_alias), 0, limit - 1)
            result = []
            for sid in session_ids:
                tkey = self._tkey(sid, db_alias)
                latest = self._r.lindex(tkey, -1)
                if latest:
                    result.append(json.loads(latest))
            return result

    def get_session_list(self, limit: int = 50, db_alias: str = "") -> list[dict]:
        session_ids = self._r.zrevrange(
            self._sessions_key(db_alias), 0, limit - 1, withscores=True
        )
        result = []
        for session_id, last_ts in session_ids:
            hkey = self._hkey(session_id, db_alias)
            query_count = self._r.llen(hkey)
            last_entry_raw = self._r.lindex(hkey, -1)
            last_question = ""
            if last_entry_raw:
                last_question = json.loads(last_entry_raw).get("question", "")
            result.append({
                "session_id": session_id,
                "query_count": query_count,
                "last_question": last_question,
                "last_ts": last_ts,
                "error_count": 0,
            })
        return result

    def get_dashboard_stats(self, db_alias: str = "") -> dict:
        total_sessions = self._r.zcard(self._sessions_key(db_alias)) or 0
        total_errors = self._r.zcard(self._errors_key(db_alias)) or 0

        rlhf_entries = self.get_rlhf_log(limit=1000, signal_filter=None, db_alias=db_alias)
        positive_rlhf = sum(1 for r in rlhf_entries if r.get("signal") == "positive")
        negative_rlhf = sum(1 for r in rlhf_entries if r.get("signal") == "negative")

        session_ids = self._r.zrevrange(self._sessions_key(db_alias), 0, 99)
        total_queries = 0
        for sid in session_ids:
            total_queries += self._r.llen(self._hkey(sid, db_alias))

        traces = self.get_pipeline_traces(session_id=None, limit=200, db_alias=db_alias)
        latencies = []
        from collections import defaultdict
        node_latencies = defaultdict(list)

        for trace in traces:
            total_ms = 0
            for ev in trace.get("events", []):
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
            "positive_rlhf": positive_rlhf,
            "negative_rlhf": negative_rlhf,
            "avg_latency_ms": round(avg_latency, 1),
            "node_avg_latency": node_avg,
        }

    # ─────────────────────────────────────────
    # Config (KV Store)
    # ─────────────────────────────────────────

    def save_config(self, key: str, value: dict) -> None:
        self._r.set(f"{KEY_PREFIX}config:{key}", json.dumps(value))

    def get_config(self, key: str) -> Optional[dict]:
        val = self._r.get(f"{KEY_PREFIX}config:{key}")
        if val:
            return json.loads(val)
        return None

    def get_configs_by_prefix(self, prefix: str) -> dict[str, dict]:
        redis_prefix = f"{KEY_PREFIX}config:{prefix}"
        result = {}
        for k in self._r.scan_iter(f"{redis_prefix}*"):
            relative_key = k[len(f"{KEY_PREFIX}config:"):]
            val = self._r.get(k)
            if val:
                result[relative_key] = json.loads(val)
        return result

    # ─────────────────────────────────────────
    # Saved Queries
    # ─────────────────────────────────────────

    def save_saved_query(
        self,
        query_id: str,
        session_id: str,
        query: str,
        sql: str,
        notes: str = "",
        db_alias: str = "",
    ) -> None:
        ts = time.time()
        blob = json.dumps({
            "id": query_id,
            "session_id": session_id,
            "query": query,
            "sql": sql,
            "notes": notes,
            "db_alias": db_alias,
            "created_at": ts,
            "updated_at": ts,
        })
        pipe = self._r.pipeline()
        pipe.zadd(self._saved_queries_key(db_alias), {blob: ts})
        pipe.zadd(f"{self._saved_queries_key(db_alias)}:session:{session_id}", {blob: ts})
        pipe.expire(f"{self._saved_queries_key(db_alias)}:session:{session_id}", SESSION_TTL * 30)
        pipe.execute()

    def get_saved_query(self, query_id: str, db_alias: str = "") -> Optional[dict]:
        raw = self._r.zrevrange(self._saved_queries_key(db_alias), 0, -1)
        for r in raw:
            entry = json.loads(r)
            if entry.get("id") == query_id:
                return entry
        return None

    def list_saved_queries(self, limit: int = 50, offset: int = 0, db_alias: str = "") -> list[dict]:
        raw = self._r.zrevrange(
            self._saved_queries_key(db_alias),
            offset,
            offset + limit - 1
        )
        return [json.loads(r) for r in raw]

    def list_session_saved_queries(self, session_id: str, limit: int = 50, db_alias: str = "") -> list[dict]:
        raw = self._r.zrevrange(
            f"{self._saved_queries_key(db_alias)}:session:{session_id}",
            0,
            limit - 1
        )
        return [json.loads(r) for r in raw]

    def update_saved_query(self, query_id: str, notes: str, db_alias: str = "") -> None:
        raw = self._r.zrevrange(self._saved_queries_key(db_alias), 0, -1)
        for r in raw:
            entry = json.loads(r)
            if entry.get("id") == query_id:
                entry["notes"] = notes
                entry["updated_at"] = time.time()
                ts = entry["updated_at"]
                blob = json.dumps(entry)
                session_id = entry.get("session_id", "")
                self._r.zrem(self._saved_queries_key(db_alias), r)
                self._r.zadd(self._saved_queries_key(db_alias), {blob: ts})
                if session_id:
                    self._r.zrem(f"{self._saved_queries_key(db_alias)}:session:{session_id}", r)
                    self._r.zadd(f"{self._saved_queries_key(db_alias)}:session:{session_id}", {blob: ts})
                break

    def delete_saved_query(self, query_id: str, db_alias: str = "") -> None:
        raw = self._r.zrevrange(self._saved_queries_key(db_alias), 0, -1)
        for r in raw:
            entry = json.loads(r)
            if entry.get("id") == query_id:
                session_id = entry.get("session_id", "")
                pipe = self._r.pipeline()
                pipe.zrem(self._saved_queries_key(db_alias), r)
                if session_id:
                    pipe.zrem(f"{self._saved_queries_key(db_alias)}:session:{session_id}", r)
                pipe.execute()
                break

    # ─────────────────────────────────────────
    # DB-centric migration helpers
    # ─────────────────────────────────────────

    def _migrate_connections_registry(self):
        """Copy connections from config KV store into the dh:databases registry."""
        if self._r.get(f"{KEY_PREFIX}migration:connections_registry"):
            return

        raw = self._r.get(f"{KEY_PREFIX}config:connections")
        if not raw:
            return

        try:
            connections = json.loads(raw).get("list", [])
        except (json.JSONDecodeError, KeyError):
            return

        ts = time.time()
        registry = {}
        for c in connections:
            alias = c.get("alias")
            if not alias:
                continue
            registry[alias] = {
                "dialect": c.get("dialect", ""),
                "display_name": c.get("display_name", alias),
                "created_at": ts,
            }

        if registry:
            self._r.set(f"{KEY_PREFIX}databases", json.dumps(registry))

        self._r.set(
            f"{KEY_PREFIX}migration:connections_registry",
            json.dumps({"done": True, "ts": ts})
        )
