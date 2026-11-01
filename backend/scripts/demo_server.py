"""Run the real application with a scripted model.

    python -m scripts.demo_server --port 8091

Used to capture the README screenshots and as a UI smoke test. There is no server-side model, so the UI
starts "not connected"; connecting with any well-formed Azure endpoint and key succeeds because the
credential probe is answered by the scripted model. Nothing here calls Azure.
"""

from __future__ import annotations

import argparse
import tempfile
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from pydantic import SecretStr

from app.core.config import Settings
from app.core.constants import Environment
from app.core.secrets import sha256_hex
from app.llm.factory import LlmFactory
from app.main import create_app
from scripts.demo.scripted_llm import ScriptedLLM

DEMO_ADMIN_PASSWORD = "demo-admin-password"  # noqa: S105 - published on purpose; demo only


def build_demo_app(storage: Path) -> FastAPI:
    LlmFactory.client = lambda self, connection: ScriptedLLM()  # type: ignore[method-assign,assignment]
    settings = Settings(
        _env_file=None,
        app_env=Environment.LOCAL,
        storage_dir=storage,
        admin_token_sha256=SecretStr(sha256_hex(DEMO_ADMIN_PASSWORD)),
        analyze_rate_per_minute=1000,
        connect_rate_per_minute=1000,
        feedback_rate_per_minute=1000,
        log_level="WARNING",
    )
    return create_app(settings, llm=None, embedder=None)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8091)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as storage:
        uvicorn.run(build_demo_app(Path(storage)), host="127.0.0.1", port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
