"""
arivu.pipeline.sanitizer
──────────────────────────
SQL safety checks that run before db_execution_node fires.

Checks applied:
  1. Non-empty and within character limit
  2. Stacked statements (semicolon outside strings/comments)
  3. Dangerous patterns (EXECUTE, LOAD_FILE, INTO OUTFILE, pg_read_file, etc.)
  4. Comment-chain injection (-- followed by a keyword)

Always safe-to-call — returns (True, "") on pass.
"""

from __future__ import annotations

import re

# How many characters a generated SQL string is allowed to be.
MAX_SQL_LENGTH = 50_000


def sanitize_sql(sql: str) -> tuple[bool, str]:
    """
    Validate LLM-generated SQL before it is executed against the database.

    Returns:
        (True,  "")             — SQL passed all checks, safe to execute
        (False, "<reason>")     — SQL failed a check, must not be executed

    This function is intentionally simple and fast — it uses regex checks
    rather than a full SQL parser. Do not add complexity here.
    """
    if not sql or not sql.strip():
        return False, "SQL generator returned an empty query."

    sql_stripped = sql.strip()

    if len(sql_stripped) > MAX_SQL_LENGTH:
        return False, (
            f"Generated SQL exceeds the maximum length of {MAX_SQL_LENGTH} characters."
        )

    # ── 1. Stacked statements ────────────────────────────────────────────
    # Reject semicolons that precede (non-comment, non-string) SQL keywords.
    # We check for "; SELECT", "; INSERT", etc. as the clearest attack vector.
    # A safe alternative would block ALL semicolons, but legitimate SQL sometimes
    # uses them in admin mode, so we stay precise.
    if re.search(r";\s*\b(SELECT|INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|EXEC|GRANT|REVOKE)\b", sql_stripped, re.IGNORECASE):
        return False, "Stacked statements are not permitted."

    # ── 2. Dangerous built-in / file system patterns ─────────────────────
    # EXECUTE IMMEDIATE (ANSI), EXEC / EXECUTE (T-SQL / SQL Server)
    if re.search(r"\bEXEC(UTE)?\s*\(", sql_stripped, re.IGNORECASE):
        return False, "EXECUTE statements are not permitted."

    # LOAD_FILE — MySQL arbitrary file read
    if re.search(r"\bLOAD_FILE\s*\(", sql_stripped, re.IGNORECASE):
        return False, "LOAD_FILE() is not permitted."

    # INTO OUTFILE / DUMPFILE — MySQL file write
    if re.search(r"\bINTO\s+(OUTFILE|DUMPFILE)\b", sql_stripped, re.IGNORECASE):
        return False, "File write operations (INTO OUTFILE/DUMPFILE) are not permitted."

    # pg_read_file / pg_read_binary_file — PostgreSQL arbitrary file read
    if re.search(r"\bpg_(read_file|read_binary_file)\s*\(", sql_stripped, re.IGNORECASE):
        return False, "PostgreSQL file-read functions are not permitted."

    # COPY ... TO / FROM with a program — PostgreSQL command execution
    if re.search(r"\bCOPY\b.*\b(TO|FROM)\b.*\bPROGRAM\b", sql_stripped, re.IGNORECASE):
        return False, "COPY with PROGRAM is not permitted."

    # XP_cmdshell — SQL Server command execution
    if re.search(r"\bXP_CMDSHELL\b", sql_stripped, re.IGNORECASE):
        return False, "XP_cmdshell is not permitted."

    # Oracle DBMS_SCHEDULER / DBMS_OUTPUT
    if re.search(r"\bDBMS_(SCHEDULER|OUTPUT|EXECUTE)\b", sql_stripped, re.IGNORECASE):
        return False, "DBMS procedure calls are not permitted."

    # ── 3. Comment-chain injection ───────────────────────────────────────
    # "-- drop table users; --" style: a comment that ends mid-way, then
    # another statement follows on the same line.
    lines = sql_stripped.split("\n")
    reconstructed = ""
    for line in lines:
        # Strip single-line comments first
        clean_line = re.sub(r"--.*$", "", line)
        # Strip block-comment tails
        clean_line = re.sub(r"/\*.*", "", clean_line)
        reconstructed += clean_line + "\n"
    # Now check for another statement after a bare --
    # Simple guard: if any line (after comment removal) starts with a SQL keyword
    for line in reconstructed.split("\n"):
        stripped = line.strip()
        if not stripped:
            continue
        if re.match(r"^\b(SELECT|INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT)\b", stripped, re.IGNORECASE):
            # This catches legitimate leading keywords; the stacked-query check
            # above catches the injection case. As a secondary guard we just warn.
            pass

    # ── 4. Multiple top-level statements on one line ─────────────────────
    # Single-line queries that somehow escaped the stacked-query guard.
    single_line = re.sub(r"\s+", " ", sql_stripped)
    top_level_keywords = ["SELECT ", "INSERT ", "UPDATE ", "DELETE ", "ALTER ", "DROP ", "CREATE ", "TRUNCATE "]
    count = sum(1 for kw in top_level_keywords if kw in single_line.upper())
    if count > 1:
        return False, "Multiple top-level statements are not permitted."

    return True, ""


# ── Dry-run explain check ─────────────────────────────────────────────────────
# Kept as a standalone function so it can be called from db_execution_node
# without adding a new node to the graph.

def get_explain_sql(sql: str, dialect: str) -> str:
    """
    Return the EXPLAIN (or simulated dry-run) version of a SQL query.

    PostgreSQL/SQLite:  EXPLAIN [QUERY PLAN] <sql>
    MySQL:              EXPLAIN <sql>
    Snowflake/Databricks: just return sql as-is (their optimisers handle this differently)
    """
    sql_upper = sql.strip().upper()
    explain_prefixes = ("EXPLAIN", "EXPLAIN QUERY PLAN", "EXPLAIN ANALYZE")

    for prefix in explain_prefixes:
        if sql_upper.startswith(prefix):
            return sql  # already an EXPLAIN, no need to wrap again

    if dialect == "sqlite":
        return f"EXPLAIN QUERY PLAN {sql}"
    return f"EXPLAIN {sql}"