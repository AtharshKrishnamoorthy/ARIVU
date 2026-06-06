"""
Tests for arivu.connection.core — Arivu.connect(), query(), lifecycle.
Uses SQLite for zero-infra testing.
"""
import pytest
from arivu.connection.core import Arivu
from arivu.connection.exceptions import ConnectionError as ArivuConnectionError


class TestArivuConnect:
    def test_sqlite_connect(self, sqlite_connection_params):
        db = Arivu.connect(**sqlite_connection_params)
        assert db is not None
        assert db.mode == "user"
        assert db._dialect == "sqlite"
        db.close()

    def test_sqlite_connect_admin(self, sqlite_connection_params):
        params = {**sqlite_connection_params, "mode": "admin"}
        db = Arivu.connect(**params)
        assert db.mode == "admin"
        db.close()

    def test_session_id_generated(self, sqlite_connection_params):
        db = Arivu.connect(**sqlite_connection_params)
        assert len(db.session_id) > 0
        db.close()

    def test_repr(self, sqlite_connection_params):
        db = Arivu.connect(**sqlite_connection_params)
        r = repr(db)
        assert "Arivu" in r
        assert "sqlite" in r
        db.close()


class TestArivuQuery:
    def test_query_returns_dict(self, sqlite_connection_params):
        db = Arivu.connect(**sqlite_connection_params)
        result = db.query("show me users")
        assert isinstance(result, dict)
        assert "question" in result
        assert "schema_ctx" in result
        assert "session_id" in result
        assert "mode" in result
        assert "engine" in result
        db.close()

    def test_query_question_passed(self, sqlite_connection_params):
        db = Arivu.connect(**sqlite_connection_params)
        result = db.query("what are the top orders?")
        assert result["question"] == "what are the top orders?"
        db.close()

    def test_query_schema_ctx_populated(self, sqlite_connection_params):
        db = Arivu.connect(**sqlite_connection_params)
        result = db.query("show tables")
        assert result["schema_ctx"] is not None
        assert len(result["schema_ctx"]) > 0
        db.close()


class TestArivuLifecycle:
    def test_close(self, sqlite_connection_params):
        db = Arivu.connect(**sqlite_connection_params)
        db.close()
        with pytest.raises(ArivuConnectionError, match="closed"):
            db.query("test")

    def test_context_manager(self, sqlite_connection_params):
        with Arivu.connect(**sqlite_connection_params) as db:
            result = db.query("show users")
            assert result["question"] == "show users"
        # After context exit, should be closed
        with pytest.raises(ArivuConnectionError):
            db.query("test")

    def test_ping(self, sqlite_connection_params):
        db = Arivu.connect(**sqlite_connection_params)
        assert db.ping() is True
        db.close()

    def test_list_tables(self, sqlite_connection_params):
        db = Arivu.connect(**sqlite_connection_params)
        tables = db.list_tables()
        assert "users" in tables
        assert "orders" in tables
        db.close()

    def test_execute_sql(self, sqlite_connection_params):
        db = Arivu.connect(**sqlite_connection_params)
        # Use raw sqlite3 to verify data, since execute_sql returns tuples
        import sqlite3
        conn = sqlite3.connect(sqlite_connection_params["dbname"])
        cursor = conn.execute("SELECT name FROM users")
        rows = cursor.fetchall()
        conn.close()
        assert len(rows) == 2
        db.close()

    def test_execute_sql_insert(self, sqlite_connection_params):
        db = Arivu.connect(**sqlite_connection_params)
        result = db.execute_sql("INSERT INTO users (name, email) VALUES ('Charlie', 'c@test.com')")
        assert result == []
        db.close()


class TestArivuProperties:
    def test_mode_property(self, sqlite_connection_params):
        db = Arivu.connect(**sqlite_connection_params)
        assert db.mode == "user"
        db.close()

    def test_session_id_property(self, sqlite_connection_params):
        db = Arivu.connect(**sqlite_connection_params)
        sid = db.session_id
        assert isinstance(sid, str)
        assert len(sid) > 0
        db.close()

    def test_schema_ctx_property(self, sqlite_connection_params):
        db = Arivu.connect(**sqlite_connection_params)
        ctx = db.schema_ctx
        assert ctx is not None
        assert len(ctx) > 0
        db.close()

    def test_schema_age_property(self, sqlite_connection_params):
        db = Arivu.connect(**sqlite_connection_params)
        age = db.schema_age_seconds
        assert age is not None
        assert age >= 0
        db.close()

    def test_query_timeout_property(self, sqlite_connection_params):
        db = Arivu.connect(**sqlite_connection_params)
        assert db.query_timeout == 30
        db.close()
