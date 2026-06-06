"""
Tests for arivu.connection.cache — SchemaCache TTL, fingerprinting, staleness.
"""
import pytest
import time
from arivu.connection.cache import SchemaCache, _chunk_schema, _compute_fingerprint


class TestSchemaCacheInitialState:
    def test_empty_cache_not_valid(self):
        cache = SchemaCache()
        assert cache.is_valid() is False

    def test_empty_cache_is_stale(self):
        cache = SchemaCache()
        assert cache.is_stale() is True

    def test_age_seconds_none_when_empty(self):
        cache = SchemaCache()
        assert cache.age_seconds is None

    def test_expires_in_none_when_empty(self):
        cache = SchemaCache()
        assert cache.expires_in_seconds is None

    def test_fingerprint_none_when_empty(self):
        cache = SchemaCache()
        assert cache.schema_fingerprint is None


class TestSchemaCachePopulation:
    def test_populate_makes_valid(self):
        cache = SchemaCache()
        cache.populate(sql_ctx="-- Table: users\nCREATE TABLE users (id INT);", raw_schema=[{"table": "users"}])
        assert cache.is_valid() is True

    def test_populate_sets_age(self):
        cache = SchemaCache()
        cache.populate(sql_ctx="CREATE TABLE t (id INT);", raw_schema=[{"table": "t"}])
        assert cache.age_seconds is not None
        assert cache.age_seconds >= 0

    def test_populate_sets_fingerprint(self):
        cache = SchemaCache()
        cache.populate(sql_ctx="CREATE TABLE t (id INT);", raw_schema=[{"table": "t"}])
        assert cache.schema_fingerprint is not None
        assert len(cache.schema_fingerprint) == 64  # SHA-256 hex


class TestSchemaCacheStaleness:
    def test_fresh_cache_not_stale(self):
        cache = SchemaCache(ttl=3600)
        cache.populate(sql_ctx="CREATE TABLE t (id INT);", raw_schema=[{"table": "t"}])
        assert cache.is_stale() is False

    def test_expired_ttl_stale(self):
        cache = SchemaCache(ttl=0)
        cache.populate(sql_ctx="CREATE TABLE t (id INT);", raw_schema=[{"table": "t"}])
        # TTL=0: immediately stale since any elapsed time > 0
        # Note: is_stale() checks (monotonic - cached_at) > ttl
        # Since populate() sets cached_at = time.monotonic(), the diff is ~0
        # which is NOT > 0. So we need a tiny delay.
        import time
        time.sleep(0.1)
        assert cache.is_stale() is True

    def test_short_ttl_expiry(self):
        cache = SchemaCache(ttl=1)
        cache.populate(sql_ctx="CREATE TABLE t (id INT);", raw_schema=[{"table": "t"}])
        assert cache.is_stale() is False
        time.sleep(1.1)
        assert cache.is_stale() is True

    def test_expires_in_decreases(self):
        cache = SchemaCache(ttl=10)
        cache.populate(sql_ctx="CREATE TABLE t (id INT);", raw_schema=[{"table": "t"}])
        first = cache.expires_in_seconds
        time.sleep(0.1)
        second = cache.expires_in_seconds
        assert second < first


class TestSchemaCacheInvalidation:
    def test_invalidate_makes_stale(self):
        cache = SchemaCache()
        cache.populate(sql_ctx="CREATE TABLE t (id INT);", raw_schema=[{"table": "t"}])
        assert cache.is_stale() is False
        cache.invalidate()
        assert cache.is_stale() is True

    def test_clear_removes_all_data(self):
        cache = SchemaCache()
        cache.populate(sql_ctx="CREATE TABLE t (id INT);", raw_schema=[{"table": "t"}])
        cache.clear()
        assert cache.is_valid() is False
        assert cache.sql_ctx is None
        assert cache.vector_store is None
        assert cache.raw_schema is None
        assert cache.schema_fingerprint is None


class TestSchemaFingerprint:
    def test_same_schema_same_fingerprint(self):
        schema = [{"table": "users", "columns": [{"name": "id", "type": "INT"}]}]
        fp1 = _compute_fingerprint(schema)
        fp2 = _compute_fingerprint(schema)
        assert fp1 == fp2

    def test_different_schema_different_fingerprint(self):
        s1 = [{"table": "users"}]
        s2 = [{"table": "orders"}]
        assert _compute_fingerprint(s1) != _compute_fingerprint(s2)

    def test_has_schema_changed(self):
        cache = SchemaCache()
        schema1 = [{"table": "users"}]
        schema2 = [{"table": "orders"}]
        cache.populate(sql_ctx="CREATE TABLE users (id INT);", raw_schema=schema1)
        assert cache.has_schema_changed(schema1) is False
        assert cache.has_schema_changed(schema2) is True


class TestChunkSchema:
    def test_single_table(self):
        ctx = "-- Table: users\nCREATE TABLE users (id INT);\n"
        chunks = _chunk_schema(ctx)
        assert len(chunks) == 1
        assert "users" in chunks[0]

    def test_multiple_tables(self):
        ctx = (
            "-- Table: users\nCREATE TABLE users (id INT);\n"
            "-- Table: orders\nCREATE TABLE orders (id INT);\n"
        )
        chunks = _chunk_schema(ctx)
        assert len(chunks) == 2

    def test_empty_string(self):
        assert _chunk_schema("") == []


class TestSchemaCacheRepr:
    def test_empty_repr(self):
        cache = SchemaCache()
        assert "empty" in repr(cache).lower()

    def test_populated_repr(self):
        cache = SchemaCache()
        cache.populate(sql_ctx="CREATE TABLE t (id INT);", raw_schema=[{"table": "t"}])
        assert "tables=" in repr(cache)
