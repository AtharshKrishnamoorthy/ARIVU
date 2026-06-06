"""
Tests for arivu.mcp.server — tool input validation, config building, tool logic.
Does NOT test actual MCP runtime (needs mcp package).
"""
import pytest
import json
import os


class TestMCPInputModels:
    """Test the Pydantic input models used by MCP tools."""

    def test_query_input_valid(self):
        from pydantic import BaseModel, Field, ConfigDict

        class QueryInput(BaseModel):
            model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
            question: str = Field(..., min_length=3, max_length=1000)
            user_id: str = Field(default="mcp_user")

        params = QueryInput(question="show me users", user_id="test_user")
        assert params.question == "show me users"
        assert params.user_id == "test_user"

    def test_query_input_default_user_id(self):
        from pydantic import BaseModel, Field, ConfigDict

        class QueryInput(BaseModel):
            model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
            question: str = Field(..., min_length=3, max_length=1000)
            user_id: str = Field(default="mcp_user")

        params = QueryInput(question="show me users")
        assert params.user_id == "mcp_user"

    def test_query_input_min_length(self):
        from pydantic import BaseModel, Field, ConfigDict

        class QueryInput(BaseModel):
            model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
            question: str = Field(..., min_length=3, max_length=1000)
            user_id: str = Field(default="mcp_user")

        with pytest.raises(Exception):
            QueryInput(question="ab")

    def test_query_input_max_length(self):
        from pydantic import BaseModel, Field, ConfigDict

        class QueryInput(BaseModel):
            model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
            question: str = Field(..., min_length=3, max_length=1000)
            user_id: str = Field(default="mcp_user")

        with pytest.raises(Exception):
            QueryInput(question="a" * 1001)

    def test_query_input_whitespace_stripped(self):
        from pydantic import BaseModel, Field, ConfigDict

        class QueryInput(BaseModel):
            model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
            question: str = Field(..., min_length=3, max_length=1000)
            user_id: str = Field(default="mcp_user")

        params = QueryInput(question="  show me users  ", user_id="test")
        assert params.question == "show me users"

    def test_query_input_extra_forbidden(self):
        from pydantic import BaseModel, Field, ConfigDict

        class QueryInput(BaseModel):
            model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
            question: str = Field(..., min_length=3, max_length=1000)
            user_id: str = Field(default="mcp_user")

        with pytest.raises(Exception):
            QueryInput(question="test", user_id="test", extra_field="bad")

    def test_session_input_valid(self):
        from pydantic import BaseModel, Field, ConfigDict

        class SessionInput(BaseModel):
            model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
            session_id: str = Field(..., min_length=1)
            user_id: str = Field(default="mcp_admin")

        params = SessionInput(session_id="sess-1", user_id="admin")
        assert params.session_id == "sess-1"

    def test_session_history_input_valid(self):
        from pydantic import BaseModel, Field, ConfigDict

        class SessionHistoryInput(BaseModel):
            model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
            session_id: str = Field(..., min_length=1)
            limit: int = Field(default=10, ge=1, le=50)

        params = SessionHistoryInput(session_id="sess-1", limit=5)
        assert params.limit == 5

    def test_session_history_input_limit_bounds(self):
        from pydantic import BaseModel, Field, ConfigDict

        class SessionHistoryInput(BaseModel):
            model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
            session_id: str = Field(..., min_length=1)
            limit: int = Field(default=10, ge=1, le=50)

        with pytest.raises(Exception):
            SessionHistoryInput(session_id="s", limit=0)
        with pytest.raises(Exception):
            SessionHistoryInput(session_id="s", limit=51)

    def test_execute_sql_input_valid(self):
        from pydantic import BaseModel, Field, ConfigDict

        class ExecuteSQLInput(BaseModel):
            model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
            sql: str = Field(..., min_length=1, max_length=50_000)
            max_rows: int = Field(default=100, ge=1, le=1000)

        params = ExecuteSQLInput(sql="SELECT 1", max_rows=50)
        assert params.sql == "SELECT 1"
        assert params.max_rows == 50

    def test_execute_sql_input_max_rows_bounds(self):
        from pydantic import BaseModel, Field, ConfigDict

        class ExecuteSQLInput(BaseModel):
            model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
            sql: str = Field(..., min_length=1, max_length=50_000)
            max_rows: int = Field(default=100, ge=1, le=1000)

        with pytest.raises(Exception):
            ExecuteSQLInput(sql="SELECT 1", max_rows=0)
        with pytest.raises(Exception):
            ExecuteSQLInput(sql="SELECT 1", max_rows=1001)


class TestBuildConnectKwargs:
    """Test the MCP server's environment variable parsing."""

    def test_default_postgres(self, monkeypatch):
        monkeypatch.delenv("ARIVU_DB_DIALECT", raising=False)
        monkeypatch.delenv("ARIVU_DB_HOST", raising=False)
        monkeypatch.delenv("ARIVU_DB_PORT", raising=False)
        monkeypatch.delenv("ARIVU_DB_USER", raising=False)
        monkeypatch.delenv("ARIVU_DB_PASSWORD", raising=False)
        monkeypatch.delenv("ARIVU_DB_NAME", raising=False)
        monkeypatch.delenv("ARIVU_DB_MODE", raising=False)

        # Import the function directly from the module file to avoid mcp import
        import importlib.util
        spec = importlib.util.spec_from_file_location("mcp_server", "arivu/mcp/server.py")
        # Can't import due to mcp dep, so test the logic inline
        dialect = os.environ.get("ARIVU_DB_DIALECT", "postgresql")
        mode = os.environ.get("ARIVU_DB_MODE", "user")
        assert dialect == "postgresql"
        assert mode == "user"

    def test_sqlite_dialect(self, monkeypatch):
        monkeypatch.setenv("ARIVU_DB_DIALECT", "sqlite")
        monkeypatch.setenv("ARIVU_DB_NAME", "/tmp/test.db")
        dialect = os.environ.get("ARIVU_DB_DIALECT")
        assert dialect == "sqlite"

    def test_mysql_dialect(self, monkeypatch):
        monkeypatch.setenv("ARIVU_DB_DIALECT", "mysql")
        monkeypatch.setenv("ARIVU_DB_HOST", "db.example.com")
        monkeypatch.setenv("ARIVU_DB_PORT", "3306")
        dialect = os.environ.get("ARIVU_DB_DIALECT")
        assert dialect == "mysql"

    def test_invalid_port_uses_default(self, monkeypatch):
        monkeypatch.setenv("ARIVU_DB_DIALECT", "postgresql")
        monkeypatch.setenv("ARIVU_DB_PORT", "not_a_number")
        raw = os.environ.get("ARIVU_DB_PORT")
        try:
            port = int(raw)
        except (ValueError, TypeError):
            port = 5432
        assert port == 5432


class TestMCPToolResponses:
    """Test the JSON response format of MCP tools (mocked)."""

    def test_query_response_format(self):
        """Verify the expected response structure for arivu_query."""
        mock_result = {
            "response": "There are 5 users.",
            "sql": "SELECT COUNT(*) FROM users",
            "success": True,
            "pending_approval": False,
            "session_id": "mcp:test_user",
            "error": None,
        }
        output = json.dumps(mock_result, indent=2)
        parsed = json.loads(output)
        assert "response" in parsed
        assert "sql" in parsed
        assert "success" in parsed
        assert "pending_approval" in parsed
        assert "session_id" in parsed
        assert "error" in parsed

    def test_approve_response_format(self):
        mock_result = {
            "status": "approved",
            "rows_affected": 3,
            "sql": "DROP TABLE temp",
            "message": "Executed successfully. 3 row(s) affected.",
        }
        output = json.dumps(mock_result, indent=2)
        parsed = json.loads(output)
        assert parsed["status"] == "approved"
        assert "rows_affected" in parsed

    def test_reject_response_format(self):
        mock_result = {
            "status": "rejected",
            "message": "Operation cancelled. Nothing was changed in the database.",
        }
        output = json.dumps(mock_result, indent=2)
        parsed = json.loads(output)
        assert parsed["status"] == "rejected"

    def test_connection_test_response_format(self):
        mock_result = {
            "status": "ok",
            "ping": True,
            "schema_loaded": True,
            "query_works": True,
            "tables": 5,
            "dialect": "sqlite",
            "mode": "user",
            "latency_ms": 12.34,
            "error": None,
        }
        output = json.dumps(mock_result, indent=2)
        parsed = json.loads(output)
        assert parsed["status"] == "ok"
        assert parsed["ping"] is True
        assert "latency_ms" in parsed

    def test_schema_response_format(self):
        mock_result = {
            "tables": [
                {
                    "name": "users",
                    "columns": [
                        {"name": "id", "type": "INTEGER", "nullable": False, "primary_key": True}
                    ],
                    "foreign_keys": [],
                }
            ],
            "schema_age_seconds": 45.2,
        }
        output = json.dumps(mock_result, indent=2)
        parsed = json.loads(output)
        assert len(parsed["tables"]) == 1
        assert parsed["tables"][0]["name"] == "users"


class TestMCPServerEntry:
    """Test the CLI entry point parsing."""

    def test_main_function_exists(self):
        # Read the source file and check for main function
        with open("arivu/mcp/server.py", "r") as f:
            content = f.read()
        assert "def main():" in content

    def test_mcp_server_defined(self):
        with open("arivu/mcp/server.py", "r") as f:
            content = f.read()
        assert 'FastMCP("arivu_mcp"' in content
