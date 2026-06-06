"""
Shared test fixtures and utilities.
"""
import os
import sys
import tempfile
import pytest

# Ensure the project root is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


@pytest.fixture
def tmp_db_path():
    """Provide a temporary SQLite DB file path that auto-cleans."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    yield path
    # Windows may hold a lock — try with retries
    import time
    for _ in range(5):
        try:
            if os.path.exists(path):
                os.unlink(path)
            break
        except PermissionError:
            time.sleep(0.1)


@pytest.fixture
def tmp_memory_db():
    """Provide a temporary memory SQLite DB path."""
    fd, path = tempfile.mkstemp(suffix="_memory.db")
    os.close(fd)
    yield path
    import time
    for _ in range(5):
        try:
            if os.path.exists(path):
                os.unlink(path)
            break
        except PermissionError:
            time.sleep(0.1)


@pytest.fixture
def sqlite_connection_params(tmp_db_path):
    """Create a SQLite DB with sample tables for testing."""
    import sqlite3
    conn = sqlite3.connect(tmp_db_path)
    conn.executescript("""
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            total REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE INDEX idx_orders_user ON orders(user_id);
        INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com');
        INSERT INTO users (name, email) VALUES ('Bob', 'bob@example.com');
        INSERT INTO orders (user_id, total, status) VALUES (1, 100.0, 'completed');
        INSERT INTO orders (user_id, total, status) VALUES (1, 200.0, 'pending');
        INSERT INTO orders (user_id, total, status) VALUES (2, 150.0, 'completed');
    """)
    conn.commit()
    conn.close()
    yield {
        "dialect": "sqlite",
        "dbname": tmp_db_path,
        "mode": "user",
    }
