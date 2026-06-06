"""
arivu.pipeline.progress
──────────────────────────
Centralised progress/logging for the pipeline runner.

In library mode (FastAPI, Telegram, REST): routes to logger.info().
In CLI mode: pass a print-based callback for human-readable output.
"""

import logging
from typing import Callable, Optional

logger = logging.getLogger("arivu.pipeline")


class ProgressLogger:
    """
    Log pipeline progress without polluting stdout in library contexts.

    Usage:
        pl = ProgressLogger()
        pl.log("db_execution", 4, "rows=12")

        # CLI mode:
        pl = ProgressLogger(callback=print)
        pl.log("db_execution", 4, "rows=12")
        # Output: ├─ [4/N] db_execution     rows=12

    The box-drawing prefix (├─, ✔, ✖, etc.) is included only when a
    callback is provided — it is omitted when routing to the logger so
    log files stay clean.
    """

    _active: Optional["ProgressLogger"] = None

    def __init__(self, callback: Optional[Callable[[str], None]] = None) -> None:
        self._cb = callback

    @classmethod
    def set_active(cls, logger_: "ProgressLogger") -> None:
        cls._active = logger_

    @classmethod
    def get_active(cls) -> "ProgressLogger":
        if cls._active is None:
            cls._active = cls()
        return cls._active

    def log(
        self,
        node: str,
        step: int = 0,
        total: int = 0,
        detail: str = "",
    ) -> None:
        """Emit one progress line."""
        if step > 0 and total > 0:
            label = f"  ├─ [{step}/{total}] {node:<20} {detail}"
        else:
            label = f"  {node:<23} {detail}"

        if self._cb:
            self._cb(label, flush=True)
        else:
            logger.info(label)

    def log_success(self, node: str, detail: str = "") -> None:
        label = f"  ✔  {node:<21} {detail}"
        if self._cb:
            self._cb(label, flush=True)
        else:
            logger.info(label)

    def log_error(self, node: str, detail: str = "") -> None:
        label = f"  ✖  {node:<21} {detail}"
        if self._cb:
            self._cb(label, flush=True)
        else:
            logger.info(label)

    def log_pending(self, node: str, detail: str = "") -> None:
        label = f"  ⏳ {node:<21} {detail}"
        if self._cb:
            self._cb(label, flush=True)
        else:
            logger.info(label)

    # ── Convenience constructors ───────────────────────────────────────────

    def log_start(self, session_id: str, mode: str, question: str) -> None:
        """Called once at pipeline start."""
        header = f"▶  PIPELINE START  session={session_id[:12]}  mode={mode}"
        detail = f"question: {question[:80]}"
        if self._cb:
            self._cb(f"\n{'='*60}", flush=True)
            self._cb(header, flush=True)
            self._cb(f"   {detail}", flush=True)
            self._cb(f"{'='*60}", flush=True)
        else:
            logger.info(header)
            logger.info(detail)

    def log_end(self, nodes_run: int, error: str) -> None:
        """Called once at pipeline end."""
        status = "ok" if not error else f"error"
        footer = f"PIPELINE DONE  nodes={nodes_run}  status={status}"
        if self._cb:
            sep = "─" * 40
            self._cb(f"{'✔' if not error else '✖'}  {footer}", flush=True)
            self._cb(f"{'='*60}\n", flush=True)
        else:
            logger.info(footer)

    def log_crash(self, exc: str) -> None:
        if self._cb:
            self._cb(f"✖  PIPELINE CRASHED  error={exc}", flush=True)
        else:
            logger.error(f"PIPELINE CRASHED: {exc}")