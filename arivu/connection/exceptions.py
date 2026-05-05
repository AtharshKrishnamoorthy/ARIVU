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


class DialectNotInstalledError(ArivuError):
    """
    Raised when a dialect's driver package is not installed.

    Example: trying to use dialect='snowflake' without
    having snowflake-sqlalchemy installed.
    """

    def __init__(self, dialect: str, pip_install: str) -> None:
        self.dialect = dialect
        self.pip_install = pip_install
        super().__init__(
            f"Dialect '{dialect}' requires an additional driver. "
            f"Install it with: {pip_install}"
        )


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