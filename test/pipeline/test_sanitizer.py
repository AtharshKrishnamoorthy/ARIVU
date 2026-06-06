"""
Tests for arivu.pipeline.sanitizer — SQL safety checks.
"""
import pytest
from arivu.pipeline.sanitizer import sanitize_sql, get_explain_sql, MAX_SQL_LENGTH


class TestSanitizeSQL:
    def test_empty_sql_rejected(self):
        safe, reason = sanitize_sql("")
        assert safe is False
        assert "empty" in reason.lower()

    def test_whitespace_only_rejected(self):
        safe, reason = sanitize_sql("   \n\t  ")
        assert safe is False

    def test_valid_select_accepted(self):
        safe, reason = sanitize_sql("SELECT * FROM users")
        assert safe is True
        assert reason == ""

    def test_valid_select_with_where(self):
        safe, reason = sanitize_sql("SELECT name, email FROM users WHERE id = 1")
        assert safe is True

    def test_stacked_statements_rejected(self):
        safe, reason = sanitize_sql("SELECT * FROM users; DROP TABLE users")
        assert safe is False
        assert "Stacked" in reason

    def test_stacked_with_insert_rejected(self):
        safe, reason = sanitize_sql("SELECT 1; INSERT INTO users VALUES (1)")
        assert safe is False

    def test_execute_function_rejected(self):
        safe, reason = sanitize_sql("SELECT EXECUTE('cmd')")
        assert safe is False
        assert "EXECUTE" in reason

    def test_load_file_rejected(self):
        safe, reason = sanitize_sql("SELECT LOAD_FILE('/etc/passwd')")
        assert safe is False

    def test_into_outfile_rejected(self):
        safe, reason = sanitize_sql("SELECT * FROM users INTO OUTFILE '/tmp/data'")
        assert safe is False

    def test_pg_read_file_rejected(self):
        safe, reason = sanitize_sql("SELECT pg_read_file('config.ini')")
        assert safe is False

    def test_copy_program_rejected(self):
        safe, reason = sanitize_sql("COPY users TO PROGRAM 'cat /etc/passwd'")
        assert safe is False

    def test_xp_cmdshell_rejected(self):
        safe, reason = sanitize_sql("EXEC XP_CMDSHELL 'dir'")
        assert safe is False

    def test_dbms_scheduler_rejected(self):
        safe, reason = sanitize_sql("BEGIN DBMS_SCHEDULER.run_job('my_job'); END;")
        assert safe is False

    def test_multiple_top_level_rejected(self):
        safe, reason = sanitize_sql("SELECT * FROM users INSERT INTO orders VALUES (1)")
        assert safe is False
        assert "Multiple" in reason

    def test_exceeds_max_length_rejected(self):
        long_sql = "SELECT " + "a, " * (MAX_SQL_LENGTH // 3) + " FROM users"
        safe, reason = sanitize_sql(long_sql)
        assert safe is False
        assert "exceeds" in reason.lower()

    def test_valid_join_accepted(self):
        safe, reason = sanitize_sql(
            "SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id"
        )
        assert safe is True

    def test_valid_aggregate_accepted(self):
        safe, reason = sanitize_sql(
            "SELECT COUNT(*), AVG(total) FROM orders GROUP BY status"
        )
        assert safe is True

    def test_valid_subquery_accepted(self):
        safe, reason = sanitize_sql(
            "SELECT * FROM users WHERE id IN (SELECT user_id FROM orders WHERE total > 100)"
        )
        assert safe is True


class TestGetExplainSQL:
    def test_sqlite_explain(self):
        sql = get_explain_sql("SELECT * FROM users", "sqlite")
        assert sql == "EXPLAIN QUERY PLAN SELECT * FROM users"

    def test_postgres_explain(self):
        sql = get_explain_sql("SELECT * FROM users", "postgresql")
        assert sql == "EXPLAIN SELECT * FROM users"

    def test_mysql_explain(self):
        sql = get_explain_sql("SELECT * FROM users", "mysql")
        assert sql == "EXPLAIN SELECT * FROM users"

    def test_already_explain_not_wrapped(self):
        sql = get_explain_sql("EXPLAIN SELECT * FROM users", "postgresql")
        assert sql == "EXPLAIN SELECT * FROM users"

    def test_explain_analyze_not_wrapped(self):
        sql = get_explain_sql("EXPLAIN ANALYZE SELECT * FROM users", "postgresql")
        assert sql == "EXPLAIN ANALYZE SELECT * FROM users"
