"""
Arivu Test Suite
────────────────
Comprehensive automated tests for the Arivu AI framework.

Structure:
    connection/     — DB connection layer (auth, cache, schema, exceptions)
    llm/            — LLM provider abstraction and registry
    memory/         — Memory layer (SQLite backend, store API)
    pipeline/       — Pipeline (state, runner, progress, sanitizer, edges)
    mcp/            — MCP server tools and configuration
    integrations/   — Integration adapters (base, session mapping)
    dashboard/      — Dashboard backend routers

All tests use SQLite (zero-infra) and mock external services.
Run with: pytest test/ -v
"""
