"""
arivu.connection.exceptions
───────────────────────────────────
All exceptions raised by the connection layer.

Hierarchy:
    ArivuError                (base)
    ├── AuthError             bad credentials, unreachable host, invalid mode
    ├── ConnectionError       TCP / engine lifecycle failures
    ├── SchemaExtractionError introspection or embedding failed
    └── ModeViolationError    query not permitted for the current mode
"""


class ArivuError(Exception):
    """Base class for all Arivu exceptions."""


class AuthError(ArivuError):
    """
    Raised when credentials are invalid, the host is unreachable,
    or the requested mode is not permitted.
    """


class ConnectionError(ArivuError):
    """
    Raised for TCP-level or engine lifecycle failures that happen
    after initial auth (e.g. mid-session connection drop).
    """


class SchemaExtractionError(ArivuError):
    """
    Raised when DB introspection or schema embedding fails.
    The connection itself is still live — the user can retry
    by calling db.refresh_schema().
    """


class ModeViolationError(ArivuError):
    """
    Raised by the query verifier when the generated SQL contains
    a statement not permitted by the current connection mode.

    Example: a user-mode connection generating a DROP TABLE statement.
    """

    def __init__(self, mode: str, statement: str, reason: str = "") -> None:
        self.mode = mode
        self.statement = statement
        msg = (
            f"Mode '{mode}' does not permit '{statement}' operations."
        )
        if reason:
            msg += f" {reason}"
        super().__init__(msg)