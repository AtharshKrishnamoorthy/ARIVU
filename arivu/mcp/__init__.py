"""
arivu.mcp
─────────
MCP server sub-package for Arivu.

Provides the Model Context Protocol server that lets any MCP client
(Claude Desktop, Cursor, etc.) query databases through Arivu.
"""

from .server import mcp

__all__ = ["mcp"]
