"""Application factory."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app import __version__
from app.api import admin, admin_auth, admin_conversations, governance, public, session
from app.api.handlers import install_handlers
from app.api.middleware import OPENAPI_PATH, install_middleware
from app.bootstrap import AUTO, Auto, Services, build_services
from app.catalog.ops import bootstrap_from_manifest
from app.core.config import Settings, get_settings
from app.core.constants import API_PREFIX, Environment
from app.core.logging import configure_logging
from app.core.secrets import Redactor
from app.llm.port import LLM, Embedder

log = logging.getLogger("app")

MANIFEST_NAME = "sources.yaml"
NOT_FOUND = {"code": "not_found", "detail": "Not found."}
TITLE = "Claim Coverage Assistant"
SUMMARY = "Cited, honest answers to 'is this home-insurance claim covered?'"
DESCRIPTION = (
    "Assesses a claim against the policy documents in force on the loss date. Every conclusion cites "
    "verified quotes; weak evidence lowers confidence instead of being hidden. Bring your own Azure "
    "OpenAI credentials."
)


def create_app(
    settings: Settings | None = None,
    *,
    llm: LLM | Auto | None = AUTO,
    embedder: Embedder | Auto | None = AUTO,
) -> FastAPI:
    settings = settings or get_settings()
    redactor = Redactor(settings.secret_values())
    configure_logging(settings.log_level, redactor)
    services: Services = build_services(settings, redactor=redactor, llm=llm, embedder=embedder)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if services.store.is_empty:
            created = await bootstrap_from_manifest(
                services.store, services.embedder, settings.data_dir / MANIFEST_NAME, settings.data_dir
            )
            log.info("seeded_catalog", extra={"versions": created})
        log.info(
            "startup",
            extra={
                "version": __version__,
                "env": settings.app_env.value,
                "contracts": len(services.store.catalog.contracts),
                "server_llm": services.llm_ready,
                "byo_credentials": settings.allow_byo_credentials,
                "admin_enabled": services.admin_auth.enabled,
            },
        )
        yield
        await services.http_client.aclose()

    app = FastAPI(
        title=TITLE,
        version=__version__,
        summary=SUMMARY,
        description=DESCRIPTION,
        lifespan=lifespan,
        docs_url=f"{API_PREFIX}/docs" if settings.app_env is not Environment.PRODUCTION else None,
        redoc_url=None,
        openapi_url=OPENAPI_PATH,
    )
    app.state.services = services
    install_middleware(app, settings)
    install_handlers(app)
    for module in (public, session, admin_auth, admin, admin_conversations, governance):
        app.include_router(module.router)
    _mount_frontend(app, settings.static_dir)
    return app


def _mount_frontend(app: FastAPI, static_dir: Path) -> None:
    """Serve the built React app, with SPA fallback to index.html."""
    index = static_dir / "index.html"
    if not index.exists():
        log.info("frontend_not_built: API only")
        return
    root = static_dir.resolve()
    assets = static_dir / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{path:path}", include_in_schema=False, response_model=None)
    async def spa(path: str) -> FileResponse | JSONResponse:
        if path.startswith(f"{API_PREFIX.lstrip('/')}/"):
            return JSONResponse(NOT_FOUND, status_code=404)
        candidate = (root / path).resolve()
        if path and candidate.is_file() and root in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
