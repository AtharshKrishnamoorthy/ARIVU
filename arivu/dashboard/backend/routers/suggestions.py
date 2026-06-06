"""
arivu.dashboard.backend.routers.suggestions
─────────────────────────────────────────
Dynamic, schema-aware query suggestions for the UI.
"""

import os
from typing import Optional
import json
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from ..dependencies import get_db
from ....connection.core import Arivu

router = APIRouter(prefix="/api/suggestions")

_RATE_LIMIT = os.environ.get("ARIVU_SUGGESTIONS_RATE_LIMIT", "20/minute")

try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    _limiter = Limiter(key_func=get_remote_address)
    _rate_limited = _limiter.limit(_RATE_LIMIT)
except ImportError:
    _rate_limited = lambda fn: fn


@router.get("")
@_rate_limited
async def get_suggestions(
    request: Request,
    context: Optional[str] = Query(None, description="Previous question to generate follow-ups for"),
    db: Arivu = Depends(get_db)
):
    """
    Generate contextual query suggestions based on the connected schema.
    If `context` is provided, generates follow-up questions.
    """
    try:
        from ....pipeline.nodes import _get_llm
        
        # We need the schema summary. 
        schema_summary = ""
        try:
            from sqlalchemy import inspect
            with db.engine.connect() as conn:
                inspector = inspect(db.engine)
                tables = inspector.get_table_names()
                schema_summary = f"Tables: {', '.join(tables)}"
        except Exception:
            schema_summary = "Unknown schema"

        llm = _get_llm()
        
        if context:
            prompt = f"""Given this database schema summary:
{schema_summary}

The user just asked: "{context}"

Suggest exactly 3 logical follow-up analytical questions the user might want to ask next to dig deeper into the data.
Return ONLY a valid JSON array of strings. Do not include markdown fences.

Example output:
["Can we break this down by region?", "How does this compare to last month?"]"""
        else:
            prompt = f"""Given this database schema summary:
{schema_summary}

Suggest exactly 4 interesting, specific analytical questions a user might ask.
Try to use the actual table names.
Return ONLY a valid JSON array of strings. Do not include markdown fences.

Example output:
["What is the total revenue by month?", "List the top 5 customers by sales"]"""

        response = llm.invoke(prompt).content.strip()
        
        # Clean up markdown if the LLM adds it
        if response.startswith("```"):
            lines = response.splitlines()
            inner = lines[1:-1] if lines[-1].strip() in ("```", "```json") else lines[1:]
            response = "\n".join(inner).strip()

        suggestions = json.loads(response)
        if not isinstance(suggestions, list):
            suggestions = ["List all tables", "Show row counts per table", "Find the most recent records"]
            
        return {"suggestions": suggestions[:3 if context else 4]}

    except Exception as exc:
        # Fallback suggestions if anything fails
        return {"suggestions": [
            "List all tables in the database",
            "Show the row counts for each table",
            "What columns exist in the primary tables?",
            "Show me the most recent records"
        ]}
