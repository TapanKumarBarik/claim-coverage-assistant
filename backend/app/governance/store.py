"""Append-only JSONL store for governance events, with size-based rotation.

Single-writer by design. To scale out, replace this class with a database or Application
Insights sink behind the same two methods.
"""

from __future__ import annotations

import logging
import os
import threading
from pathlib import Path

from app.governance.models import AiEvent

log = logging.getLogger(__name__)

BYTES_PER_MB = 1024 * 1024
LOG_NAME = "governance.jsonl"
ROTATED_SUFFIX = ".1"


class GovernanceStore:
    def __init__(self, root: Path, *, max_mb: int) -> None:
        root.mkdir(parents=True, exist_ok=True)
        self._path = root / LOG_NAME
        self._rotated = self._path.with_name(LOG_NAME + ROTATED_SUFFIX)
        self._max_bytes = max_mb * BYTES_PER_MB
        self._lock = threading.Lock()

    def append(self, event: AiEvent) -> None:
        line = event.model_dump_json() + "\n"
        with self._lock:
            if self._path.exists() and self._path.stat().st_size + len(line) > self._max_bytes:
                os.replace(self._path, self._rotated)  # keep one previous generation
            with self._path.open("a", encoding="utf-8") as handle:
                handle.write(line)

    def read_all(self) -> list[AiEvent]:
        """Every retained event, oldest first."""
        events: list[AiEvent] = []
        with self._lock:
            for path in (self._rotated, self._path):
                if not path.exists():
                    continue
                for line in path.read_text(encoding="utf-8").splitlines():
                    if line.strip():
                        events.append(AiEvent.model_validate_json(line))
        return events
