"""
arivu.pipeline.graph
───────────────────────────
Assembles and compiles the LangGraph StateGraph.

The compiled graph is a singleton — built once at import time and
reused across all pipeline.run() calls. Thread-safe by LangGraph's design.

Usage (internal — called by pipeline.run()):
    from arivu.pipeline.graph import get_compiled_graph

    graph = get_compiled_graph()
    final_state = graph.invoke(initial_state)
"""

from __future__ import annotations

import logging
from functools import lru_cache

from langgraph.graph import StateGraph, END

from .state import GraphState
from .nodes import (
    query_intake_node,
    sql_generator_node,
    query_verifier_node,
    admin_approval_node,
    db_execution_node,
    result_embedder_node,
    retrieval_agent_node,
    result_verifier_node,
    response_generator_node,
    memory_write_node,
    rlhf_feedback_node,
    error_boundary_node,
    pending_end_node,
)
from .edges import (
    route_after_sql_generator,
    route_after_query_verifier,
    route_after_admin_approval,
    route_after_db_execution,
    route_after_result_embedder,
    route_after_retrieval_agent,
    route_after_result_verifier,
    route_after_response_generator,
)

logger = logging.getLogger("arivu.pipeline.graph")


@lru_cache(maxsize=1)
def get_compiled_graph():
    """
    Build and compile the LangGraph StateGraph.
    Cached — only compiled once per process.
    """
    logger.info("Compiling Arivu LangGraph pipeline...")

    builder = StateGraph(GraphState)

    # ── Register all nodes ──────────────────────────────────────────────
    builder.add_node("query_intake",        query_intake_node)
    builder.add_node("sql_generator",       sql_generator_node)
    builder.add_node("query_verifier",      query_verifier_node)
    builder.add_node("admin_approval",      admin_approval_node)
    builder.add_node("db_execution",        db_execution_node)
    builder.add_node("result_embedder",     result_embedder_node)
    builder.add_node("retrieval_agent",     retrieval_agent_node)
    builder.add_node("result_verifier",     result_verifier_node)
    builder.add_node("response_generator",  response_generator_node)
    builder.add_node("memory_write",        memory_write_node)
    builder.add_node("rlhf_feedback",       rlhf_feedback_node)
    builder.add_node("error_boundary",      error_boundary_node)
    builder.add_node("pending_end",         pending_end_node)

    # ── Entry point ─────────────────────────────────────────────────────
    builder.set_entry_point("query_intake")

    # ── Fixed edges ─────────────────────────────────────────────────────
    builder.add_edge("query_intake", "sql_generator")
    builder.add_edge("memory_write", "rlhf_feedback")
    builder.add_edge("rlhf_feedback", END)
    builder.add_edge("error_boundary", END)
    builder.add_edge("pending_end", END)

    # ── Conditional edges ───────────────────────────────────────────────
    builder.add_conditional_edges(
        "sql_generator",
        route_after_sql_generator,
        {
            "query_verifier":  "query_verifier",
            "error_boundary":  "error_boundary",
        },
    )

    builder.add_conditional_edges(
        "query_verifier",
        route_after_query_verifier,
        {
            "sql_generator":   "sql_generator",    # retry loop
            "admin_approval":  "admin_approval",   # RLHF gate
            "db_execution":    "db_execution",
            "error_boundary":  "error_boundary",
        },
    )

    builder.add_conditional_edges(
        "admin_approval",
        route_after_admin_approval,
        {
            "db_execution":   "db_execution",
            "error_boundary": "error_boundary",
            "pending_end":    "pending_end",
        },
    )

    builder.add_conditional_edges(
        "db_execution",
        route_after_db_execution,
        {
            "sql_generator":       "sql_generator",       # retry loop for retriable errors
            "result_embedder":     "result_embedder",
            "response_generator":  "response_generator",  # empty result fast-path
            "error_boundary":      "error_boundary",
        },
    )

    builder.add_conditional_edges(
        "result_embedder",
        route_after_result_embedder,
        {
            "retrieval_agent": "retrieval_agent",
            "error_boundary":  "error_boundary",
        },
    )

    builder.add_conditional_edges(
        "retrieval_agent",
        route_after_retrieval_agent,
        {
            "result_verifier": "result_verifier",
            "error_boundary":  "error_boundary",
        },
    )

    builder.add_conditional_edges(
        "result_verifier",
        route_after_result_verifier,
        {
            "retrieval_agent":     "retrieval_agent",    # re-retrieve loop
            "response_generator":  "response_generator",
        },
    )

    builder.add_conditional_edges(
        "response_generator",
        route_after_response_generator,
        {
            "memory_write":    "memory_write",
            "error_boundary":  "error_boundary",
        },
    )

    graph = builder.compile()
    logger.info("Pipeline graph compiled successfully")
    return graph