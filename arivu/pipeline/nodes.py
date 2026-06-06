"""
arivu.pipeline.nodes
───────────────────────────
Every LangGraph node is a pure function:
    (GraphState) -> GraphState

Nodes never call each other directly — they only read/write state.
The graph wires them together via edges and conditional edges.

Node order:
    query_intake_node
    sql_generator_node
    query_verifier_node       ← conditional edge (pass / fail+retry / max_retries)
    db_execution_node
    result_embedder_node
    retrieval_agent_node
    result_verifier_node      ← conditional edge (pass / fail+re-retrieve / max_retries)
    response_generator_node
    memory_write_node
    rlhf_feedback_node
    error_boundary_node       ← terminal, reached from any node on unrecoverable error
"""

from __future__ import annotations

import re
import time
import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .state import GraphState
from ..connection.auth import mode_permits, is_destructive

logger = logging.getLogger("arivu.pipeline")

# ─────────────────────────────────────────────────────────────────────────────
# Retriable DB Error Detection
# ─────────────────────────────────────────────────────────────────────────────

def _is_retriable_db_error(exc: Exception) -> bool:
    """
    Determine if a DB error is retriable (can be fixed by SQL regeneration).
    Returns True if the error matches patterns like grouping misuse,
    window function issues, or syntax problems that the LLM can address.
    """
    err_text = str(exc).lower()
    retriable_patterns = [
        r"must appear in the group by clause",
        r"cannot be used in the select list without an aggregate",
        r"window function.+cannot be used with group by",
        r"column .+ does not exist",
        r"syntax error",
        r"relation .+ does not exist",
        r"table .+ does not exist",
        r"no such table",
        r"no such column",
    ]
    for pattern in retriable_patterns:
        if re.search(pattern, err_text, re.IGNORECASE):
            return True
    return False


# ─────────────────────────────────────────────────────────────────────────────
# Shared LLM helper (uses the arivu.llm multi-provider abstraction layer)
# ─────────────────────────────────────────────────────────────────────────────

def _get_llm():
    """
    Return the configured LLM provider instance.
    Uses the arivu.llm.get_llm() factory which reads from:
      - Dashboard-saved config (memory store)
      - ARIVU_LLM_PROVIDER / ARIVU_LLM_MODEL env vars
    """
    from ..llm import get_llm
    return get_llm()


# ─────────────────────────────────────────────────────────────────────────────
# Dialect-aware prompt hints  (SCHEMA-08)
# ─────────────────────────────────────────────────────────────────────────────

DIALECT_NOTES = {
    "postgresql": (
        "Use PostgreSQL syntax. "
        "Identifiers in double quotes if needed. "
        "Date functions: NOW(), CURRENT_DATE, CURRENT_TIMESTAMP. "
        "String aggregation: STRING_AGG(col, delimiter). "
        "Pattern matching: ILIKE for case-insensitive, ~ for regex. "
        "To list tables: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'. "
        "To list columns: SELECT column_name FROM information_schema.columns WHERE table_name = 'table_name'."
    ),
    "mysql": (
        "Use MySQL syntax. "
        "Identifiers in backticks if needed. "
        "Date functions: NOW(), CURDATE(). "
        "String aggregation: GROUP_CONCAT(col SEPARATOR ','). "
        "Pattern matching: LIKE for simple, REGEXP for regex. "
        "To list tables: SHOW TABLES. "
        "To list columns: SHOW COLUMNS FROM table_name."
    ),
    "sqlite": (
        "Use SQLite syntax. Identifiers in double quotes or backticks. "
        "Date functions: datetime('now'), date('now'). "
        "To list tables: SELECT name FROM sqlite_master WHERE type='table'. "
        "To list columns: PRAGMA table_info('table_name')."
    ),
    "snowflake": (
        "Use Snowflake SQL. "
        "Identifiers in double quotes. "
        "String aggregation: LISTAGG(col, ',') WITHIN GROUP (ORDER BY ...). "
        "To list tables: SELECT table_name FROM information_schema.tables. "
        "To list columns: SELECT column_name FROM information_schema.columns WHERE table_name = 'table_name'."
    ),
    "databricks": (
        "Use Databricks SQL (Spark-compatible). "
        "Identifiers in backticks. "
        "String aggregation: CONCAT_WS(',', COLLECT_LIST(col)). "
        "To list tables: SHOW TABLES. "
        "To list columns: SHOW COLUMNS IN table_name."
    ),
}


# ─────────────────────────────────────────────────────────────────────────────
# NODE 1 — Query Intake
# ─────────────────────────────────────────────────────────────────────────────

def query_intake_node(state: GraphState) -> GraphState:
    """
    Entry node. Loads session memory and attaches it to the state.
    Schema staleness is already handled by db.query() before this runs.
    """
    t0 = time.perf_counter()
    logger.info(f"[query_intake] session={state.session_id}  q='{state.question[:60]}'")

    try:
        state.original_question = state.question  # preserve raw user input for DB storage

        # Load only the last 3 turns — keeps the LLM prompt small
        from ..memory.store import load_session_history
        history = load_session_history(state.session_id, limit=3)
        if history:
            context = _format_history(history)
            state.question = f"{context}\n\nCurrent question: {state.question}"
            logger.debug(f"[query_intake] history_turns={len(history)}")

        state.retry_count = 0
        state.result_retry_count = 0
        state.record_trace("query_intake", "ok", _ms(t0))

    except Exception as exc:
        logger.warning(f"[query_intake] memory load failed (non-fatal): {exc}")
        state.record_trace("query_intake", "ok", _ms(t0), detail="memory load skipped")

    return state


# ─────────────────────────────────────────────────────────────────────────────
# NODE 2 — SQL Generator
# ─────────────────────────────────────────────────────────────────────────────

def sql_generator_node(state: GraphState) -> GraphState:
    """
    Translate the NL question into SQL using schema context + conversation
    history. On a retry, the verifier's error feedback is appended to the
    prompt so the LLM self-corrects.

    Schema bloat guard (PROD-04):
      If the FAISS schema vector store is available, only the top-k most
      semantically relevant table definitions are injected into the prompt
      instead of the full schema dump. Falls back to the full schema_ctx
      when no vector store is present (e.g. zero-table DBs or embedded mode).
    """
    t0 = time.perf_counter()
    logger.info(f"[sql_generator] attempt={state.retry_count + 1}")

    try:
        llm = _get_llm()

        filtered_schema = _select_relevant_schema(
            question=state.question,
            full_schema_ctx=state.schema_ctx,
            vector_store=state.vector_store,
            dialect=state.dialect,
        )

        prompt = _build_sql_prompt(
            question=state.question,
            schema_ctx=filtered_schema,
            error_feedback=state.verifier_error,
            mode=state.mode,
            dialect=state.dialect,
        )
        response = llm.invoke(prompt)
        state.sql = _extract_sql(response.content)
        state.verifier_error = ""   # clear previous error
        state.record_trace(
            "sql_generator", "ok", _ms(t0),
            detail=f"sql={state.sql[:80]}"
        )

    except Exception as exc:
        state.set_error("sql_generator", exc)
        state.record_trace("sql_generator", "fail", _ms(t0), detail=str(exc))

    return state


# ─────────────────────────────────────────────────────────────────────────────
# NODE 3 — Query Verifier  (drives a conditional edge)
# ─────────────────────────────────────────────────────────────────────────────

def query_verifier_node(state: GraphState) -> GraphState:
    """
    Validates the generated SQL before it touches the DB.

    Checks:
      1. SQL is non-empty and parseable
      2. Mode permissions (user cannot emit DROP/ALTER/etc.)
      3. Destructive ops in admin mode → set requires_approval = True
      4. Max retries not exceeded

    Sets state.verifier_error on failure so the SQL generator
    knows why it's being retried.
    """
    t0 = time.perf_counter()
    logger.info(f"[query_verifier] sql='{state.sql[:80]}'")

    if not state.sql or not state.sql.strip():
        state.verifier_error = "SQL generator returned an empty query."
        state.retry_count += 1
        state.record_trace("query_verifier", "retry", _ms(t0), detail=state.verifier_error)
        return state

    # Mode permission check
    permitted, reason = mode_permits(state.mode, state.sql)
    if not permitted:
        state.verifier_error = reason
        state.retry_count += 1
        state.record_trace("query_verifier", "retry", _ms(t0), detail=reason)
        return state

    # Flag destructive ops for admin RLHF gate
    if is_destructive(state.sql) and state.mode == "admin":
        state.requires_approval = True
        logger.info(f"[query_verifier] destructive op detected — RLHF gate required")

    # Basic syntax sanity (no full parse, just keyword check)
    # Strip any leading parentheses or whitespaces to handle UNIONs and subqueries correctly
    sql_upper = state.sql.strip().upper().lstrip("(\n\r\t ")
    valid_starts = {"SELECT", "INSERT", "UPDATE", "DELETE", "ALTER", "DROP", "CREATE", "WITH", "TRUNCATE"}
    first_word = sql_upper.split()[0] if sql_upper.split() else ""
    if first_word not in valid_starts:
        state.verifier_error = f"Generated text does not look like SQL: '{state.sql[:60]}'"
        state.retry_count += 1
        state.record_trace("query_verifier", "retry", _ms(t0), detail=state.verifier_error)
        return state

    state.record_trace("query_verifier", "ok", _ms(t0))
    return state


# ─────────────────────────────────────────────────────────────────────────────
# NODE 3b — Admin Approval Gate  (only reached when requires_approval=True)
# ─────────────────────────────────────────────────────────────────────────────

def admin_approval_node(state: GraphState) -> GraphState:
    """
    Blocks pipeline execution until a human approves the destructive SQL.

    In practice this node surfaces the pending SQL to the user/admin
    via the integration layer (Telegram / WhatsApp / REST) and waits
    for an explicit approve/reject signal.

    For now this is implemented as a synchronous stub that logs the
    pending approval — the async approval flow is handled by the
    integration layer calling db.approve(session_id) or db.reject(session_id).
    """
    t0 = time.perf_counter()
    logger.warning(
        f"[admin_approval] PENDING  session={state.session_id}"
    )

    from ..memory.store import save_pending_approval
    save_pending_approval(
        session_id=state.session_id,
        sql=state.sql,
        question=state.question,
        db_alias=state.db_alias,
    )

    state.approved = None   # integration layer will flip this
    state.record_trace(
        "admin_approval", "ok", _ms(t0),
        detail=f"approval pending for: {state.sql[:60]}"
    )
    return state


# ─────────────────────────────────────────────────────────────────────────────
# NODE 4 — DB Execution
# ─────────────────────────────────────────────────────────────────────────────

def db_execution_node(state: GraphState) -> GraphState:
    """
    Execute the verified SQL against the DB and capture raw rows.

    Sanity-checks (CRIT-01 fixes):
      - Stacked statement guard
      - Dangerous built-in / file-system function blocks
      - Character limit

    Any SQLAlchemy exception is caught here — the error boundary handles routing.
    """
    from .sanitizer import sanitize_sql

    t0 = time.perf_counter()
    logger.info(f"[db_execution] executing  sql='{state.sql[:80]}'")

    # ── Sanity check before touching the DB ──────────────────────────────
    safe, reason = sanitize_sql(state.sql)
    if not safe:
        state.set_error("db_execution", RuntimeError(f"SQL rejected: {reason}"))
        logger.warning(f"[db_execution] rejected: {reason}")
        state.record_trace("db_execution", "fail", _ms(t0), detail=reason)
        return state

    try:
        with state.engine.connect() as conn:
            result = conn.execute(text(state.sql))

            if result.returns_rows:
                # SELECT — fetch all rows as usual
                rows = result.fetchall()
                keys = list(result.keys()) if rows else []
                state.raw_result = [dict(zip(keys, row)) for row in rows]
            else:
                # DML (UPDATE / INSERT / DELETE) — commit and report affected rows
                conn.commit()
                affected = result.rowcount if result.rowcount is not None else 0
                state.raw_result = [{"rows_affected": affected, "status": "success"}]
                logger.info(f"[db_execution] dml committed  rows_affected={affected}")

        logger.info(f"[db_execution] rows={len(state.raw_result)}")
        logger.info(f"[db_execution] complete  rows={len(state.raw_result)}")
        state.record_trace(
            "db_execution", "ok", _ms(t0),
            detail=f"rows={len(state.raw_result)}"
        )

    except SQLAlchemyError as exc:
        err_text = str(exc)
        if _is_retriable_db_error(exc):
            # Surface to SQL generator as verifier feedback and attempt retry
            state.verifier_error = f"DB execution error: {err_text}"
            state.retry_count += 1
            state.record_trace("db_execution", "retry", _ms(t0), detail=state.verifier_error)
            logger.info(f"[db_execution] retriable error surfaced to verifier: {err_text[:100]}")
        else:
            # Non-retriable — treat as terminal execution error
            state.set_error("db_execution", exc)
            state.record_trace("db_execution", "fail", _ms(t0), detail=err_text)

    except Exception as exc:
        state.set_error("db_execution", exc)
        state.record_trace("db_execution", "fail", _ms(t0), detail=str(exc))

    return state


# ─────────────────────────────────────────────────────────────────────────────
# Shared embedding model cache (avoids reloading on every query)
# ─────────────────────────────────────────────────────────────────────────────

_embeddings_cache = None

def _get_embeddings():
    """Return a cached embedding model instance."""
    global _embeddings_cache
    if _embeddings_cache is None:
        from langchain_huggingface import HuggingFaceEmbeddings
        _embeddings_cache = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
        )
    return _embeddings_cache


# ─────────────────────────────────────────────────────────────────────────────
# NODE 5 — Result Embedder
# ─────────────────────────────────────────────────────────────────────────────

def result_embedder_node(state: GraphState) -> GraphState:
    """
    Embed the raw DB result rows into a FAISS vector store.

    Each row is a separate document. The original NL question is stored
    as metadata so the retrieval agent can score against it.
    Avoids context-bloating the LLM with all rows at once.
    """
    t0 = time.perf_counter()
    logger.info(f"[result_embedder] rows={len(state.raw_result)}")

    if not state.raw_result:
        state.record_trace("result_embedder", "skip", _ms(t0), detail="no rows to embed")
        return state

    try:
        from langchain_community.vectorstores import FAISS
        from langchain_core.documents import Document

        embeddings = _get_embeddings()

        docs = [
            Document(
                page_content=_row_to_text(row, i),
                metadata={"row_index": i, "question": state.question},
            )
            for i, row in enumerate(state.raw_result)
        ]

        state.result_vector_store = FAISS.from_documents(docs, embeddings)
        state.record_trace(
            "result_embedder", "ok", _ms(t0),
            detail=f"embedded {len(docs)} rows"
        )

    except Exception as exc:
        state.set_error("result_embedder", exc)
        state.record_trace("result_embedder", "fail", _ms(t0), detail=str(exc))

    return state


# ─────────────────────────────────────────────────────────────────────────────
# NODE 6 — Retrieval Agent
# ─────────────────────────────────────────────────────────────────────────────

def retrieval_agent_node(state: GraphState) -> GraphState:
    """
    Semantic search over the embedded result rows.
    Returns top-k most relevant chunks to the NL question.
    Re-ranking is done by cosine similarity score.
    """
    t0 = time.perf_counter()
    logger.info(f"[retrieval_agent] fetching top-k for '{state.question[:60]}'")

    if state.result_vector_store is None:
        # No rows to retrieve from — pass through empty
        state.retrieved_chunks = []
        state.record_trace("retrieval_agent", "skip", _ms(t0), detail="no vector store")
        return state

    try:
        k = min(5, len(state.raw_result))
        docs_with_scores = state.result_vector_store.similarity_search_with_score(
            state.question, k=k
        )
        # Sort by score ascending (lower = more similar in FAISS L2)
        docs_with_scores.sort(key=lambda x: x[1])
        state.retrieved_chunks = [doc.page_content for doc, _ in docs_with_scores]

        state.record_trace(
            "retrieval_agent", "ok", _ms(t0),
            detail=f"retrieved {len(state.retrieved_chunks)} chunks"
        )

    except Exception as exc:
        state.set_error("retrieval_agent", exc)
        state.record_trace("retrieval_agent", "fail", _ms(t0), detail=str(exc))

    return state


# ─────────────────────────────────────────────────────────────────────────────
# NODE 7 — Result Verifier  (drives a conditional edge)
# ─────────────────────────────────────────────────────────────────────────────

def result_verifier_node(state: GraphState) -> GraphState:
    """
    Semantic check: do the retrieved chunks actually answer the NL question?

    Uses a lightweight LLM call to score relevance.
    On failure, increments result_retry_count so the retrieval agent
    can try a different top-k or re-rank strategy.
    """
    t0 = time.perf_counter()
    logger.info(f"[result_verifier] chunks={len(state.retrieved_chunks)}")

    if not state.retrieved_chunks:
        state.result_verifier_error = "No results retrieved from the database."
        state.result_retry_count += 1
        state.record_trace(
            "result_verifier", "retry", _ms(t0),
            detail=state.result_verifier_error
        )
        return state

    try:
        llm = _get_llm()
        prompt = _build_verifier_prompt(
            question=state.question,
            chunks=state.retrieved_chunks,
        )
        verdict = llm.invoke(prompt).content.strip().lower()

        if verdict.startswith("yes"):
            state.result_verifier_error = ""
            state.record_trace("result_verifier", "ok", _ms(t0))
        else:
            state.result_verifier_error = (
                f"Retrieved results don't sufficiently answer the question. "
                f"LLM verdict: {verdict[:120]}"
            )
            state.result_retry_count += 1
            state.record_trace(
                "result_verifier", "retry", _ms(t0),
                detail=state.result_verifier_error
            )

    except Exception as exc:
        # Verifier failure is non-fatal — proceed with what we have
        logger.warning(f"[result_verifier] verification failed (non-fatal): {exc}")
        state.record_trace(
            "result_verifier", "ok", _ms(t0),
            detail="verification skipped due to error"
        )

    return state


# ─────────────────────────────────────────────────────────────────────────────
# NODE 8 — Response Generator
# ─────────────────────────────────────────────────────────────────────────────

def response_generator_node(state: GraphState) -> GraphState:
    """
    Synthesise a natural language answer from the retrieved chunks.
    The LLM is given the question, the SQL that was run, and the top-k rows.
    """
    t0 = time.perf_counter()
    logger.info(f"[response_generator] generating answer")

    try:
        llm = _get_llm()
        
        # Architecture Bypass Mapping: if we skipped embedding due to small results,
        # fallback to passing the raw rows directly as context payload strings.
        effective_chunks = state.retrieved_chunks
        if not effective_chunks and state.raw_result:
            effective_chunks = [str(row) for row in state.raw_result]

        prompt = _build_response_prompt(
            question=state.question,
            sql=state.sql,
            chunks=effective_chunks,
        )
        state.response = llm.invoke(prompt).content.strip()
        state.record_trace(
            "response_generator", "ok", _ms(t0),
            detail=f"response_len={len(state.response)}"
        )

    except Exception as exc:
        state.set_error("response_generator", exc)
        state.record_trace("response_generator", "fail", _ms(t0), detail=str(exc))

    return state


# ─────────────────────────────────────────────────────────────────────────────
# NODE 9 — Memory Write + Output
# ─────────────────────────────────────────────────────────────────────────────

def memory_write_node(state: GraphState) -> GraphState:
    """
    Persist the NL → SQL → result triple to session memory.
    Also emits the full trace event list to the tracing dashboard.
    """
    t0 = time.perf_counter()
    logger.info(f"[memory_write] session={state.session_id[:12]}")

    try:
        from ..memory.store import save_interaction
        save_interaction(
            session_id=state.session_id,
            question=state.original_question or state.question,
            sql=state.sql,
            response=state.response,
            trace_events=state.trace_events,
            db_alias=state.db_alias,
            dialect=state.dialect,
            connection_meta=state.connection_meta,
            interface=state.interface,
        )
        state.record_trace("memory_write", "ok", _ms(t0))

    except Exception as exc:
        logger.warning(f"[memory_write] failed to persist (non-fatal): {exc}")
        state.record_trace("memory_write", "fail", _ms(t0), detail=str(exc))

    return state


# ─────────────────────────────────────────────────────────────────────────────
# NODE 10 — RLHF Feedback
# ─────────────────────────────────────────────────────────────────────────────

def rlhf_feedback_node(state: GraphState) -> GraphState:
    """
    Collect and persist RLHF signal after the response is delivered.

    For user mode: thumbs up / down on the response.
    For admin mode: approval / rejection of the SQL execution.

    The signal is stored in the RLHF feedback store and surfaced
    in the tracing dashboard's RLHF log panel.
    """
    t0 = time.perf_counter()
    if state.rlhf_signal:
        logger.info(f"[rlhf_feedback] signal={state.rlhf_signal}")

    if state.rlhf_signal is None:
        state.record_trace("rlhf_feedback", "skip", _ms(t0), detail="no signal yet")
        return state

    try:
        from ..memory.store import save_rlhf_signal
        save_rlhf_signal(
            session_id=state.session_id,
            question=state.question,
            sql=state.sql,
            signal=state.rlhf_signal,
            approved=state.approved,
            db_alias=state.db_alias,
            dialect=state.dialect,
            interface=state.interface,
        )
        state.record_trace(
            "rlhf_feedback", "ok", _ms(t0),
            detail=f"signal={state.rlhf_signal}"
        )

    except Exception as exc:
        logger.warning(f"[rlhf_feedback] failed (non-fatal): {exc}")
        state.record_trace("rlhf_feedback", "fail", _ms(t0), detail=str(exc))

    return state


# ─────────────────────────────────────────────────────────────────────────────
# NODE 11 — Error Boundary  (terminal on unrecoverable error)
# ─────────────────────────────────────────────────────────────────────────────

def error_boundary_node(state: GraphState) -> GraphState:
    """
    Terminal node reached when an unrecoverable error occurs.

    Responsibilities:
      - Log the full error with context
      - Emit error event to the tracing dashboard
      - Set a user-facing error response
      - Never raise — always returns cleanly
    """
    t0 = time.perf_counter()

    # Fallbacks for empty error states (e.g. from max retries exceeded)
    if not state.error:
        state.error = state.verifier_error or "Unknown error or max retries exceeded."
        state.error_type = "MaxRetriesExceeded" if state.retry_count >= 3 else "Unknown"
        state.error_node = state.error_node or "query_verifier"

    logger.error(
        f"[error_boundary] node={state.error_node}  "
        f"type={state.error_type}  error={str(state.error)[:120]}"
    )

    # Set a safe user-facing response
    if not state.response:
        state.response = (
            "Sorry, I ran into an issue processing your request. "
            "Please try rephrasing your question or contact support "
            f"with session ID: {state.session_id}"
        )

    try:
        from ..memory.store import save_error_event
        save_error_event(
            session_id=state.session_id,
            error=state.error,
            error_node=state.error_node,
            error_type=state.error_type,
            question=state.original_question or state.question,
            sql=state.sql,
            trace_events=state.trace_events,
            db_alias=state.db_alias,
            dialect=state.dialect,
            connection_meta=state.connection_meta,
            interface=state.interface,
        )
    except Exception as exc:
        logger.warning(f"[error_boundary] failed to persist error event: {exc}")

    state.record_trace(
        "error_boundary", "fail", _ms(t0),
        detail=f"{state.error_type}: {state.error}"
    )
    return state


# ─────────────────────────────────────────────────────────────────────────────
# NODE 12 — Pending End  (terminal on awaiting admin approval)
# ─────────────────────────────────────────────────────────────────────────────

def pending_end_node(state: GraphState) -> GraphState:
    t0 = time.perf_counter()
    logger.info(f"[pending_end] awaiting approval  session={state.session_id[:12]}")
    state.response = (
        f"⏳ Approval required for this operation.\n"
        f"SQL: {state.sql}\n\n"
        f"To approve: POST /approve/{state.session_id}\n"
        f"To reject:  POST /reject/{state.session_id}"
    )
    state.record_trace("pending_end", "pending", _ms(t0))
    return state


# ─────────────────────────────────────────────────────────────────────────────
# Prompt builders
# ─────────────────────────────────────────────────────────────────────────────

def _build_sql_prompt(
    question: str,
    schema_ctx: str,
    error_feedback: str,
    mode: str,
    dialect: str = "",
) -> str:
    mode_note = (
        "You are in USER mode. Generate SELECT queries only."
        if mode == "user"
        else "You are in ADMIN mode. You may generate any valid SQL including DDL."
    )
    dialect_note = DIALECT_NOTES.get(dialect, "")
    retry_note = ""
    if error_feedback:
        retry_note = f"\n\nPrevious attempt failed with this error — fix it:\n{error_feedback}"

    return f"""You are a {dialect or 'SQL'} expert. Given a database schema and a natural language question,
generate a single valid SQL query that answers the question.

{dialect_note}

{mode_note}

SCHEMA:
{schema_ctx}

QUESTION:
{question}
{retry_note}

Return ONLY the SQL query, no explanation, no markdown fences."""


def _build_verifier_prompt(question: str, chunks: list[str]) -> str:
    chunks_text = "\n---\n".join(chunks)
    return f"""You are a data quality checker.

QUESTION: {question}

RETRIEVED DATA:
{chunks_text}

Does the retrieved data sufficiently answer the question?
Reply with exactly: YES or NO followed by a one-sentence reason."""


def _build_response_prompt(
    question: str,
    sql: str,
    chunks: list[str],
) -> str:
    chunks_text = "\n".join(f"- {c}" for c in chunks)
    return f"""You are a helpful data assistant. Answer the user's question
using only the data provided below. Be concise and factual.

QUESTION: {question}

SQL EXECUTED:
{sql}

DATA:
{chunks_text}

Answer in plain English. If the data doesn't fully answer the question, say so."""


# ─────────────────────────────────────────────────────────────────────────────
# Schema selector (PROD-04)
# ─────────────────────────────────────────────────────────────────────────────

def _select_relevant_schema(
    question: str,
    full_schema_ctx: str,
    vector_store,
    dialect: str,
) -> str:
    """
    Filter the full schema context to only tables semantically relevant
    to the natural-language question using the pre-built FAISS vector store.

    Falls back to the full schema_ctx if any step fails, so this is always
    safe to call — it never causes schema context to be empty.

    Retrieves up to 10 most relevant table chunks and joins them back into
    a compact schema_ctx string for the LLM prompt.
    """
    if vector_store is None or not full_schema_ctx:
        return full_schema_ctx

    try:
        docs_with_scores = vector_store.similarity_search_with_score(
            question, k=min(10, len(full_schema_ctx))
        )

        if not docs_with_scores:
            return full_schema_ctx

        docs_with_scores.sort(key=lambda x: x[1])
        chunks = [doc.page_content for doc, _ in docs_with_scores]

        table_count = len(chunks)
        filtered_ctx = "\n\n".join(chunks)
        logger.info(
            f"[schema_selector] pruned schema  "
            f"selected_tables={table_count}  "
            f"ctx_chars={len(filtered_ctx)}  "
            f"(was {len(full_schema_ctx)} chars)"
        )
        return filtered_ctx

    except Exception as exc:
        logger.warning(f"[schema_selector] filtering failed, using full schema: {exc}")
        return full_schema_ctx


# ─────────────────────────────────────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────────────────────────────────────

def _ms(t0: float) -> float:
    return (time.perf_counter() - t0) * 1000


def _row_to_text(row: dict, index: int) -> str:
    pairs = ", ".join(f"{k}={v}" for k, v in row.items())
    return f"Row {index + 1}: {pairs}"


def _extract_sql(raw: str) -> str:
    """Strip markdown fences and whitespace from LLM output."""
    raw = raw.strip()

    # Strip reasoning blocks (<think>...</think>) from chain-of-thought models
    import re
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()

    if raw.startswith("```"):
        lines = raw.splitlines()
        # drop first and last fence lines
        inner = lines[1:-1] if lines[-1].strip() in ("```", "```sql") else lines[1:]
        raw = "\n".join(inner).strip()
    return raw


def _format_history(history: list[dict]) -> str:
    """
    Format the last 3 session turns into a compact context string.
    Keeps snippets short to stay within model TPM limits.
    """
    lines = ["Previous conversation (last 3 turns):"]
    for entry in history[-3:]:
        q = entry.get("question", "").replace("\n", " ")[:60]
        a = entry.get("response", "").replace("\n", " ")[:60]
        lines.append(f"  Q: {q}")
        lines.append(f"  A: {a}")
    return "\n".join(lines)
