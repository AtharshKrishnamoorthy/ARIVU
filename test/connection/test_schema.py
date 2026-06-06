"""
Tests for arivu.connection.schema — introspection and serialization.
Uses SQLite with sample tables.

Note: These tests require a live SQLite database with sample tables.
They are skipped if the database cannot be created.
"""
import pytest
from sqlalchemy import create_engine, text


@pytest.fixture
def sample_engine(tmp_db_path):
    import sqlite3
    conn = sqlite3.connect(tmp_db_path)
    conn.executescript("""
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE
        );
        CREATE TABLE orders (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            total REAL NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE INDEX idx_orders_user ON orders(user_id);
        INSERT INTO users VALUES (1, 'Alice', 'alice@test.com');
        INSERT INTO orders VALUES (1, 1, 100.0);
    """)
    conn.commit()
    conn.close()
    return create_engine(f"sqlite:///{tmp_db_path}")


class TestExtractSchema:
    def test_returns_list(self, sample_engine):
        from arivu.connection.schema import extract_schema
        schema = extract_schema(sample_engine, "sqlite")
        assert isinstance(schema, list)

    def test_finds_tables(self, sample_engine):
        from arivu.connection.schema import extract_schema
        schema = extract_schema(sample_engine, "sqlite")
        table_names = [t["table"] for t in schema]
        assert "users" in table_names
        assert "orders" in table_names

    def test_table_has_columns(self, sample_engine):
        from arivu.connection.schema import extract_schema
        schema = extract_schema(sample_engine, "sqlite")
        users = next(t for t in schema if t["table"] == "users")
        assert len(users["columns"]) >= 3

    def test_column_has_type(self, sample_engine):
        from arivu.connection.schema import extract_schema
        schema = extract_schema(sample_engine, "sqlite")
        users = next(t for t in schema if t["table"] == "users")
        id_col = next(c for c in users["columns"] if c["name"] == "id")
        assert "type" in id_col
        assert "nullable" in id_col
        assert "primary_key" in id_col

    def test_primary_key_detected(self, sample_engine):
        from arivu.connection.schema import extract_schema
        schema = extract_schema(sample_engine, "sqlite")
        users = next(t for t in schema if t["table"] == "users")
        id_col = next(c for c in users["columns"] if c["name"] == "id")
        assert id_col["primary_key"] is True

    def test_foreign_keys_detected(self, sample_engine):
        from arivu.connection.schema import extract_schema
        schema = extract_schema(sample_engine, "sqlite")
        orders = next(t for t in schema if t["table"] == "orders")
        assert len(orders["foreign_keys"]) >= 1

    def test_indexes_detected(self, sample_engine):
        from arivu.connection.schema import extract_schema
        schema = extract_schema(sample_engine, "sqlite")
        orders = next(t for t in schema if t["table"] == "orders")
        assert len(orders["indexes"]) >= 1


class TestSerializeToSqlCtx:
    def test_returns_string(self, sample_engine):
        from arivu.connection.schema import extract_schema, serialize_to_sql_ctx
        schema = extract_schema(sample_engine, "sqlite")
        ctx = serialize_to_sql_ctx(schema)
        assert isinstance(ctx, str)
        assert len(ctx) > 0

    def test_contains_create_table(self, sample_engine):
        from arivu.connection.schema import extract_schema, serialize_to_sql_ctx
        schema = extract_schema(sample_engine, "sqlite")
        ctx = serialize_to_sql_ctx(schema)
        assert "CREATE TABLE" in ctx

    def test_contains_table_names(self, sample_engine):
        from arivu.connection.schema import extract_schema, serialize_to_sql_ctx
        schema = extract_schema(sample_engine, "sqlite")
        ctx = serialize_to_sql_ctx(schema)
        assert "users" in ctx
        assert "orders" in ctx

    def test_contains_column_names(self, sample_engine):
        from arivu.connection.schema import extract_schema, serialize_to_sql_ctx
        schema = extract_schema(sample_engine, "sqlite")
        ctx = serialize_to_sql_ctx(schema)
        assert "name" in ctx
        assert "email" in ctx

    def test_contains_fk_annotation(self, sample_engine):
        from arivu.connection.schema import extract_schema, serialize_to_sql_ctx
        schema = extract_schema(sample_engine, "sqlite")
        ctx = serialize_to_sql_ctx(schema)
        assert "FK" in ctx

    def test_empty_schema_returns_empty(self):
        from arivu.connection.schema import serialize_to_sql_ctx
        ctx = serialize_to_sql_ctx([])
        assert ctx == ""
