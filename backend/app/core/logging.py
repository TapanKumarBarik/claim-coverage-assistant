"""JSON logging with a request id on every line and secrets scrubbed from every message.

Claim text is never logged; callers log identifiers and counts only.
"""

from __future__ import annotations

import json
import logging
from contextvars import ContextVar
from datetime import UTC, datetime

from app.core.secrets import Redactor

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

_STANDARD = set(logging.makeLogRecord({}).__dict__) | {"message", "asctime"}
_NOISY_LOGGERS = ("httpx", "httpcore", "openai", "azure")
_UVICORN_ACCESS = "uvicorn.access"  # we log requests ourselves


class JsonFormatter(logging.Formatter):
    def __init__(self, redactor: Redactor) -> None:
        super().__init__()
        self._redactor = redactor

    def format(self, record: logging.LogRecord) -> str:
        scrub = self._redactor.scrub
        payload: dict[str, object] = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "msg": scrub(record.getMessage()),
            "request_id": request_id_var.get(),
        }
        for key, value in record.__dict__.items():
            if key not in _STANDARD and key not in payload:
                payload[key] = scrub(value) if isinstance(value, str) else value
        if record.exc_info:
            payload["exc"] = scrub(self.formatException(record.exc_info))
        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_logging(level: str, redactor: Redactor) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter(redactor))
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level.upper())
    for noisy in _NOISY_LOGGERS:
        logging.getLogger(noisy).setLevel(logging.WARNING)
    logging.getLogger(_UVICORN_ACCESS).disabled = True
