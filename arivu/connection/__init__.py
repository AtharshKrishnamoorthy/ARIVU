"""
arivu.connection
───────────────────────
Public API for the connection layer.

    from arivu import Arivu
    from arivu.connection.exceptions import AuthError, ModeViolationError
"""

from .core import Arivu
from .exceptions import (
    ArivuError,
    AuthError,
    ConnectionError,
    SchemaExtractionError,
    ModeViolationError,
    DialectNotInstalledError,
)
from .auth import mode_permits, is_destructive, MODE_PERMISSIONS, list_dialects

__all__ = [
    "Arivu",
    # Exceptions
    "ArivuError",
    "AuthError",
    "ConnectionError",
    "SchemaExtractionError",
    "ModeViolationError",
    "DialectNotInstalledError",
    # Auth helpers (used by pipeline layer)
    "mode_permits",
    "is_destructive",
    "MODE_PERMISSIONS",
    "list_dialects",
]