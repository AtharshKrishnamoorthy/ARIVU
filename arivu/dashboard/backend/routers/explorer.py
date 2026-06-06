"""
arivu.dashboard.backend.routers.explorer
─────────────────────────────────────────
Endpoints for the Database Explorer UI.
Allows users to view table schemas and preview data.
Uses SQLAlchemy to prevent SQL injection.
"""

import logging
from fastapi import APIRouter, HTTPException, Body, Request
import sqlalchemy as sa

from . import connections  # keep import clean if needed
from ....memory.store import _get_backend
from ....connection.core import Arivu
from ..dependencies import get_cached_connection

logger = logging.getLogger("arivu.dashboard.explorer")

router = APIRouter(prefix="/api/explorer")

def _get_engine(alias: str, request: Request):
    """Retrieve a SQLAlchemy engine for the given connection alias."""
    db = get_cached_connection(request, alias)
    return db._engine

@router.get("/schema")
def get_schema(alias: str, request: Request):
    """Reflect and return the database schema (tables and columns)."""
    try:
        engine = _get_engine(alias, request)
        metadata = sa.MetaData()
        metadata.reflect(bind=engine)
        
        tables = []
        for table_name, table in metadata.tables.items():
            columns = [{"name": col.name, "type": str(col.type)} for col in table.columns]
            tables.append({"name": table_name, "columns": columns})
            
        return {"tables": tables}
    except Exception as exc:
        logger.error(f"[explorer] schema fetch failed: {exc}")
        raise HTTPException(status_code=400, detail=f"Connection Error: {exc}")

@router.get("/preview/{table_name}")
def get_preview(alias: str, table_name: str, request: Request):
    """Return the first 50 rows of a table using SQLAlchemy (SQL injection safe)."""
    try:
        engine = _get_engine(alias, request)
        metadata = sa.MetaData()
        # Autoload just this specific table
        table = sa.Table(table_name, metadata, autoload_with=engine)
        
        # Safe parameterized SELECT ... LIMIT 50
        query = sa.select(table).limit(50)
        
        with engine.connect() as conn:
            result = conn.execute(query)
            columns = list(result.keys())
            rows = [dict(row) for row in result.mappings()]
            
        return {"columns": columns, "rows": rows}
    except Exception as exc:
        logger.error(f"[explorer] data preview failed for table {table_name}: {exc}")
        raise HTTPException(status_code=400, detail=f"Data Fetch Error: {exc}")


@router.post("/query")
def run_chart_query(request: Request, payload: dict = Body(...)):
    """
    Execute a safe, column-specific SELECT for the widget builder.
    Uses SQLAlchemy column objects to prevent SQL injection.

    Expected body:
        {
            "alias": "CHINOOK",
            "table": "tracks",
            "columns": ["genre", "unit_price"],
            "limit": 100,
            "aggregate": "sum"          # optional: sum | avg | count | min | max
        }
    """
    alias = payload.get("alias")
    table_name = payload.get("table")
    col_names = payload.get("columns", [])
    limit = min(payload.get("limit", 500), 5000)
    aggregate = payload.get("aggregate")   # optional

    if not alias or not table_name or not col_names:
        raise HTTPException(status_code=400, detail="alias, table, and columns are required.")

    try:
        engine = _get_engine(alias, request)
        metadata = sa.MetaData()
        table = sa.Table(table_name, metadata, autoload_with=engine)

        # Validate that every requested column actually exists on the table
        available = {c.name for c in table.columns}
        for cn in col_names:
            if cn not in available:
                raise HTTPException(
                    status_code=400,
                    detail=f"Column '{cn}' does not exist on table '{table_name}'. "
                           f"Available: {sorted(available)}"
                )

        sa_cols = [table.c[cn] for cn in col_names]

        # Build query — optionally with GROUP BY + aggregate
        if aggregate and len(col_names) >= 2:
            agg_funcs = {
                "sum": sa.func.sum,
                "avg": sa.func.avg,
                "count": sa.func.count,
                "min": sa.func.min,
                "max": sa.func.max,
            }
            agg_fn = agg_funcs.get(aggregate)
            if not agg_fn:
                raise HTTPException(status_code=400, detail=f"Unknown aggregate: {aggregate}")

            group_col = sa_cols[0]
            value_col = sa_cols[1]
            query = (
                sa.select(group_col, agg_fn(value_col).label(col_names[1]))
                .group_by(group_col)
                .limit(limit)
            )
        else:
            query = sa.select(*sa_cols).limit(limit)

        with engine.connect() as conn:
            result = conn.execute(query)
            columns = list(result.keys())
            rows = [dict(row) for row in result.mappings()]

        return {"columns": columns, "rows": rows}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[explorer] chart query failed: {exc}")
        raise HTTPException(status_code=400, detail=f"Query Error: {exc}")
