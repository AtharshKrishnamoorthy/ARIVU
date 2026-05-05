"""
arivu.pipeline.edges
───────────────────────────
Conditional edge routing functions for LangGraph.

Each function inspects GraphState and returns the name of the next node.
LangGraph calls these after the corresponding node completes.

Edge map:
    after query_intake          → sql_generator  (always)
    after sql_generator         → route_after_sql_generator
    after query_verifier        → route_after_query_verifier
    after admin_approval        → route_after_admin_approval
    after db_execution          → route_after_db_execution
    after result_embedder       → retrieval_agent  (always, unless error)
    after retrieval_agent       → result_verifier  (always, unless error)
    after result_verifier       → route_after_result_verifier
    after response_generator    → memory_write  (always, unless error)
    after memory_write          → rlhf_feedback  (always)
    after rlhf_feedback         → END
    after error_boundary        → END
"""

from __future__ import annotations
from .state import GraphState


# ─────────────────────────────────────────────────────────────────────────────
# After SQL Generator
# ─────────────────────────────────────────────────────────────────────────────

def route_after_sql_generator(state: GraphState) -> str:
    """
    If SQL generator hit an error → error_boundary.
    Otherwise → query_verifier.
    """
    if state.has_error():
        return "error_boundary"
    return "query_verifier"


# ─────────────────────────────────────────────────────────────────────────────
# After Query Verifier
# ─────────────────────────────────────────────────────────────────────────────

def route_after_query_verifier(state: GraphState) -> str:
    """
    fail + retries left  → sql_generator  (retry with error context)
    fail + max retries   → error_boundary
    pass + destructive   → admin_approval  (admin mode RLHF gate)
    pass + clean         → db_execution
    """
    if state.verifier_error:
        if state.retry_count >= state.max_retries:
            return "error_boundary"
        return "sql_generator"

    if state.requires_approval:
        return "admin_approval"

    return "db_execution"


# ─────────────────────────────────────────────────────────────────────────────
# After Admin Approval Gate
# ─────────────────────────────────────────────────────────────────────────────

def route_after_admin_approval(state: GraphState) -> str:
    """
    approved = True   → db_execution
    approved = False  → error_boundary  (rejection treated as terminal)
    approved = None   → error_boundary  (timeout / no response)
    """
    if state.approved is True:
        return "db_execution"
    if state.approved is False:
        return "error_boundary"      # explicit reject
    return "pending_end" 


# ─────────────────────────────────────────────────────────────────────────────
# After DB Execution
# ─────────────────────────────────────────────────────────────────────────────

def route_after_db_execution(state: GraphState) -> str:
    """
    error set → error_boundary
    no rows   → response_generator  (let it explain "no results found")
    <= 200 rows -> response_generator (short-circuit FAISS ML layer)
    > 200 rows  → result_embedder
    """
    if state.has_error():
        return "error_boundary"
    if not state.raw_result:
        return "response_generator"
    
    # OVERHAUL BYPASS: If dataset is small, directly feed LLM contexts without embeddings
    if len(state.raw_result) <= 200:
        return "response_generator"

    return "result_embedder"


# ─────────────────────────────────────────────────────────────────────────────
# After Result Embedder
# ─────────────────────────────────────────────────────────────────────────────

def route_after_result_embedder(state: GraphState) -> str:
    if state.has_error():
        return "error_boundary"
    return "retrieval_agent"


# ─────────────────────────────────────────────────────────────────────────────
# After Retrieval Agent
# ─────────────────────────────────────────────────────────────────────────────

def route_after_retrieval_agent(state: GraphState) -> str:
    if state.has_error():
        return "error_boundary"
    return "result_verifier"


# ─────────────────────────────────────────────────────────────────────────────
# After Result Verifier
# ─────────────────────────────────────────────────────────────────────────────

def route_after_result_verifier(state: GraphState) -> str:
    """
    fail + retries left  → retrieval_agent  (re-retrieve with tighter query)
    fail + max retries   → response_generator  (best effort with what we have)
    pass                 → response_generator
    """
    if state.result_verifier_error:
        if state.result_retry_count < state.max_result_retries:
            return "retrieval_agent"
        # Exhausted retries — proceed with best-effort response
        return "response_generator"
    return "response_generator"


# ─────────────────────────────────────────────────────────────────────────────
# After Response Generator
# ─────────────────────────────────────────────────────────────────────────────

def route_after_response_generator(state: GraphState) -> str:
    if state.has_error():
        return "error_boundary"
    return "memory_write"