"""
examples/memory_usage.py
─────────────────────────
Demonstrates memory layer usage — both direct and via the pipeline.
"""

import os
import time

# ── 1. Default: SQLite backend (zero config) ──────────────────────────────────

from ARIVU.memory import (
    load_session_history,
    save_interaction,
    save_rlhf_signal,
    get_rlhf_log,
    get_error_log,
    get_pipeline_traces,
    get_session_list,
    get_pending_approval,
    resolve_approval,
)

session_id = "sess-demo-001"

# Directly save an interaction (normally done by memory_write_node)
save_interaction(
    session_id=session_id,
    question="how many orders were placed last week?",
    sql="SELECT COUNT(*) FROM orders WHERE created_at >= NOW() - INTERVAL '7 days'",
    response="There were 342 orders placed in the last 7 days.",
    trace_events=[
        {"node": "query_intake",  "status": "ok", "latency_ms": 2.1},
        {"node": "sql_generator", "status": "ok", "latency_ms": 810.4},
        {"node": "query_verifier","status": "ok", "latency_ms": 5.2},
        {"node": "db_execution",  "status": "ok", "latency_ms": 34.7},
        {"node": "memory_write",  "status": "ok", "latency_ms": 1.8},
    ],
)

# Load it back
history = load_session_history(session_id)
print(history[0]["question"])
# "how many orders were placed last week?"


# ── 2. RLHF signal ────────────────────────────────────────────────────────────

save_rlhf_signal(
    session_id=session_id,
    question="how many orders were placed last week?",
    sql="SELECT COUNT(*) FROM orders ...",
    signal="positive",
)

save_rlhf_signal(
    session_id="sess-demo-002",
    question="drop the temp table",
    sql="DROP TABLE temp_staging",
    signal="negative",
    approved=False,  # admin rejected
)

log = get_rlhf_log(limit=10)
for entry in log:
    print(f"{entry['signal']:10}  {entry['question'][:50]}")


# ── 3. Admin approval flow ────────────────────────────────────────────────────

from ARIVU.memory import save_pending_approval

save_pending_approval(
    session_id="sess-admin-003",
    sql="DROP TABLE temp_staging",
    question="drop the temp_staging table",
)

# Integration layer fetches it to show to admin
pending = get_pending_approval("sess-admin-003")
if pending:
    print(f"Pending: {pending['sql']}")
    # Admin sends /approve in Telegram
    resolve_approval("sess-admin-003", approved=True)

# Verify resolved
pending_after = get_pending_approval("sess-admin-003")
print(pending_after)  # None — resolved


# ── 4. Redis backend ──────────────────────────────────────────────────────────

os.environ["ARIVU_MEMORY_BACKEND"] = "redis"
os.environ["ARIVU_REDIS_URL"] = "redis://localhost:6379/0"

# Re-initialise backend (normally set before first import)
from ARIVU.memory import store as memory_store
memory_store._backend = None  # reset singleton for demo purposes

save_interaction(
    session_id="redis-sess-001",
    question="what is the total revenue this month?",
    sql="SELECT SUM(total) FROM orders WHERE ...",
    response="Total revenue this month is $128,450.",
    trace_events=[],
)

history = load_session_history("redis-sess-001")
print(history[0]["question"])


# ── 5. Dashboard queries ──────────────────────────────────────────────────────

# Session list (for dashboard session history panel)
sessions = get_session_list(limit=10)
for s in sessions:
    print(f"{s['session_id'][:8]}  queries={s['query_count']}  "
          f"last='{s['last_question'][:40]}'")

# Pipeline traces (for trace panel)
traces = get_pipeline_traces(session_id=session_id, limit=5)
for t in traces:
    for event in t["events"]:
        print(f"  {event['node']:<20} {event['status']:6}  {event['latency_ms']:.1f}ms")

# Error log (for error panel)
errors = get_error_log(limit=10)
for e in errors:
    print(f"[{e['error_node']}] {e['error_type']}: {e['error'][:60]}")