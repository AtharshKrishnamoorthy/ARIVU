"""
arivu.memory.backend
───────────────────────────
Storage backend abstraction.

BaseMemoryBackend defines the interface.
get_backend() is the factory — selects SQLite or Redis based on env var.

To add a new backend (e.g. Postgres):
    1. Subclass BaseMemoryBackend
    2. Implement all abstract methods
    3. Register in get_backend()
"""

from __future__ import annotations

import os
import logging
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger("arivu.memory.backend")


# ─────────────────────────────────────────────────────────────────────────────
# Interface
# ─────────────────────────────────────────────────────────────────────────────

class BaseMemoryBackend(ABC):

    @abstractmethod
    def load_session_history(self, session_id: str, limit: int = 3, db_alias: str = "") -> list[dict]: ...

    @abstractmethod
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
    ) -> None: ...

    @abstractmethod
    def save_pending_approval(
        self,
        session_id: str,
        sql: str,
        question: str,
        db_alias: str = "",
    ) -> None: ...

    @abstractmethod
    def get_pending_approval(self, session_id: str, db_alias: str = "") -> Optional[dict]: ...

    @abstractmethod
    def resolve_approval(self, session_id: str, approved: bool, db_alias: str = "") -> None: ...

    @abstractmethod
    def get_all_pending_approvals(self, db_alias: str = "") -> list[dict]: ...

    @abstractmethod
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
    ) -> None: ...

    @abstractmethod
    def get_rlhf_log(
        self,
        limit: int,
        signal_filter: Optional[str],
        db_alias: str = "",
    ) -> list[dict]: ...

    @abstractmethod
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
    ) -> None: ...

    @abstractmethod
    def get_error_log(self, limit: int, db_alias: str = "") -> list[dict]: ...

    @abstractmethod
    def get_pipeline_traces(
        self,
        session_id: Optional[str],
        limit: int,
        db_alias: str = "",
    ) -> list[dict]: ...

    @abstractmethod
    def get_session_list(self, limit: int, db_alias: str = "") -> list[dict]: ...

    @abstractmethod
    def get_dashboard_stats(self, db_alias: str = "") -> dict: ...

    # ── Config ───────────────────────────────────────────────────────────

    @abstractmethod
    def save_config(self, key: str, value: dict) -> None: ...

    @abstractmethod
    def get_config(self, key: str) -> Optional[dict]: ...

    @abstractmethod
    def get_configs_by_prefix(self, prefix: str) -> dict[str, dict]: ...

    # ── Saved Queries ────────────────────────────────────────────────────

    @abstractmethod
    def save_saved_query(
        self,
        query_id: str,
        session_id: str,
        query: str,
        sql: str,
        notes: str = "",
        db_alias: str = "",
    ) -> None: ...

    @abstractmethod
    def get_saved_query(self, query_id: str, db_alias: str = "") -> Optional[dict]: ...

    @abstractmethod
    def list_saved_queries(self, limit: int = 50, offset: int = 0, db_alias: str = "") -> list[dict]: ...

    @abstractmethod
    def list_session_saved_queries(self, session_id: str, limit: int = 50, db_alias: str = "") -> list[dict]: ...

    @abstractmethod
    def update_saved_query(self, query_id: str, notes: str, db_alias: str = "") -> None: ...

    @abstractmethod
    def delete_saved_query(self, query_id: str, db_alias: str = "") -> None: ...


# ─────────────────────────────────────────────────────────────────────────────
# Factory
# ─────────────────────────────────────────────────────────────────────────────

def get_backend(backend_type: str) -> BaseMemoryBackend:
    """
    Return the appropriate memory backend instance.

    backend_type: "sqlite" | "redis"

    Configured via ARIVU_MEMORY_BACKEND env var (default: "sqlite").
    """
    if backend_type == "sqlite":
        from .sqlite_backend import SQLiteMemoryBackend
        
        # Use workspace-local DB by default to avoid OneDrive syncing issues on C: drive
        default_path = os.path.abspath(os.path.join(os.getcwd(), ".arivu_data", "memory.db"))
        
        db_path = os.environ.get("ARIVU_SQLITE_PATH", default_path)
        logger.info(f"Memory backend: SQLite  path={db_path}")
        return SQLiteMemoryBackend(db_path=db_path)

    elif backend_type == "redis":
        from .redis_backend import RedisMemoryBackend
        redis_url = os.environ.get("ARIVU_REDIS_URL", "redis://localhost:6379/0")
        logger.info(f"Memory backend: Redis  url={redis_url}")
        return RedisMemoryBackend(redis_url=redis_url)

    else:
        raise ValueError(
            f"Unknown memory backend '{backend_type}'. "
            "Choose from: sqlite, redis"
        )