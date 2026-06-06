"""
arivu
─────
Top-level package. Re-exports the public API from sub-packages so that
consumers can write:

    from arivu import Arivu
"""

import logging
import sys

# ── Configure logging for the whole arivu package ───────────────────────────
# This must run before any submodule is imported so that all loggers
# (arivu.pipeline, arivu.connection, arivu.memory, etc.) are captured.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)-8s]  %(name)s  —  %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stdout,
    force=True,   # override any existing root-logger config
)

# Silence noisy third-party loggers so Arivu output stays clean
for _noisy in ("httpx", "httpcore", "urllib3", "sqlalchemy.engine",
               "sentence_transformers", "transformers", "torch"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

logging.getLogger("arivu").info("Arivu package loaded — logging active")

from arivu.connection import (
    Arivu,
    ArivuError,
    AuthError,
    ConnectionError,
    SchemaExtractionError,
    ModeViolationError,
)
from arivu.pipeline.runner import (
    PipelineConfig,
    PipelineResult,
    run_pipeline,
    run_pipeline_async,
)

__all__ = [
    # Connection
    "Arivu",
    "ArivuError",
    "AuthError",
    "ConnectionError",
    "SchemaExtractionError",
    "ModeViolationError",
    # Pipeline
    "PipelineConfig",
    "PipelineResult",
    "run_pipeline",
    "run_pipeline_async",
]
