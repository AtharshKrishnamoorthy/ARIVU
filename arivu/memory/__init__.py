"""
arivu.memory
───────────────────
Public API for the memory layer.

    from ARIVU.memory import (
        load_session_history,
        save_interaction,
        save_rlhf_signal,
        get_rlhf_log,
        get_error_log,
        get_pipeline_traces,
        get_session_list,
        resolve_approval,
        get_pending_approval,
    )

Backend selection (set before first import):
    export ARIVU_MEMORY_BACKEND=sqlite   # default
    export ARIVU_MEMORY_BACKEND=redis
    export ARIVU_REDIS_URL=redis://localhost:6379/0
    export ARIVU_SQLITE_PATH=~/.arivu/memory.db
"""

from .store import (
    load_session_history,
    save_interaction,
    save_pending_approval,
    get_pending_approval,
    resolve_approval,
    save_rlhf_signal,
    get_rlhf_log,
    save_error_event,
    get_error_log,
    get_pipeline_traces,
    get_session_list,
)

__all__ = [
    "load_session_history",
    "save_interaction",
    "save_pending_approval",
    "get_pending_approval",
    "resolve_approval",
    "save_rlhf_signal",
    "get_rlhf_log",
    "save_error_event",
    "get_error_log",
    "get_pipeline_traces",
    "get_session_list",
]