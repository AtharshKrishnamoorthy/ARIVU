"""
arivu.connection.schema
──────────────────────────────
DB introspection and SQL context serialisation.

extract_schema()      — queries INFORMATION_SCHEMA to get tables, columns, FKs, indexes
serialize_to_sql_ctx() — turns the raw schema dict into a CREATE TABLE-style string
                         that the LLM can reason about without being given the full DB
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import inspect, text

logger = logging.getLogger("arivu.schema")


# ─────────────────────────────────────────────────────────────────────────────
# Public
# ─────────────────────────────────────────────────────────────────────────────

def extract_schema(engine, dialect: str) -> list[dict[str, Any]]:
    """
    Introspect the database and return a list of table descriptors.

    Each descriptor has the shape:
        {
            "table": str,
            "columns": [{"name": str, "type": str, "nullable": bool, "primary_key": bool}],
            "foreign_keys": [{"column": str, "ref_table": str, "ref_column": str}],
            "indexes": [{"name": str, "columns": [str], "unique": bool}],
        }
    """
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    schema: list[dict] = []

    for table_name in tables:
        columns = _extract_columns(inspector, table_name)
        foreign_keys = _extract_foreign_keys(inspector, table_name)
        indexes = _extract_indexes(inspector, table_name)

        schema.append({
            "table": table_name,
            "columns": columns,
            "foreign_keys": foreign_keys,
            "indexes": indexes,
        })

    logger.debug(f"Extracted schema: {len(tables)} tables — {[t['table'] for t in schema]}")
    return schema


def serialize_to_sql_ctx(schema: list[dict[str, Any]]) -> str:
    """
    Serialise the raw schema into a CREATE TABLE-style SQL context string.

    This string is what gets embedded into the FAISS vector store and
    injected into the LLM's prompt as context. It is intentionally compact —
    no data, just structure.

    Example output for one table:
        -- Table: orders
        CREATE TABLE orders (
            id          INTEGER  NOT NULL  PRIMARY KEY,
            user_id     INTEGER  NOT NULL,  -- FK → users.id
            total       NUMERIC  NOT NULL,
            created_at  TIMESTAMP  NOT NULL
        );
        -- Index: idx_orders_user_id (user_id)
    """
    lines: list[str] = []

    for table in schema:
        table_name = table["table"]
        columns = table["columns"]
        foreign_keys = {fk["column"]: fk for fk in table["foreign_keys"]}

        lines.append(f"-- Table: {table_name}")
        lines.append(f"CREATE TABLE {table_name} (")

        col_lines = []
        for col in columns:
            parts = [f"    {col['name']:<24}{str(col['type']):<16}"]
            if not col["nullable"]:
                parts.append(" NOT NULL")
            if col["primary_key"]:
                parts.append("  PRIMARY KEY")
            if col["name"] in foreign_keys:
                fk = foreign_keys[col["name"]]
                parts.append(f"  -- FK → {fk['ref_table']}.{fk['ref_column']}")
            col_lines.append("".join(parts))

        lines.append(",\n".join(col_lines))
        lines.append(");")

        for idx in table["indexes"]:
            unique_str = "UNIQUE " if idx["unique"] else ""
            cols_str = ", ".join(idx["columns"])
            lines.append(
                f"-- {unique_str}Index: {idx['name']} ({cols_str})"
            )

        lines.append("")  # blank line between tables

    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _extract_columns(inspector, table_name: str) -> list[dict]:
    raw_cols = inspector.get_columns(table_name)
    pk_cols = set(inspector.get_pk_constraint(table_name).get("constrained_columns", []))

    return [
        {
            "name": col["name"],
            "type": str(col["type"]),
            "nullable": col.get("nullable", True),
            "primary_key": col["name"] in pk_cols,
        }
        for col in raw_cols
    ]


def _extract_foreign_keys(inspector, table_name: str) -> list[dict]:
    result = []
    for fk in inspector.get_foreign_keys(table_name):
        for local_col, ref_col in zip(
            fk.get("constrained_columns", []),
            fk.get("referred_columns", []),
        ):
            result.append({
                "column": local_col,
                "ref_table": fk.get("referred_table", ""),
                "ref_column": ref_col,
            })
    return result


def _extract_indexes(inspector, table_name: str) -> list[dict]:
    return [
        {
            "name": idx.get("name", "unnamed"),
            "columns": idx.get("column_names", []),
            "unique": idx.get("unique", False),
        }
        for idx in inspector.get_indexes(table_name)
    ]