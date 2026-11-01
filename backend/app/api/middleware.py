"""Request correlation, access logging and security headers."""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from time import perf_counter

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.security import DOCS_CSP, apply_security_headers, bind_request_id
from app.core.config import Settings
from app.core.constants import API_PREFIX, Header

log = logging.getLogger("app.access")

HEALTH_PATH = f"{API_PREFIX}/healthz"
DOCS_PATH = f"{API_PREFIX}/docs"
OPENAPI_PATH = f"{API_PREFIX}/openapi.json"
CORS_METHODS = ["GET", "POST", "PUT", "DELETE"]
CORS_HEADERS = [Header.AUTHORIZATION.value, Header.CONTENT_TYPE.value, Header.REQUEST_ID.value]


def install_middleware(app: FastAPI, settings: Settings) -> None:
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_methods=CORS_METHODS,
            allow_headers=CORS_HEADERS,
            allow_credentials=True,  # the session cookie; origins are an explicit allowlist, never "*"
        )

    @app.middleware("http")
    async def request_context(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = bind_request_id(request)
        started = perf_counter()
        response = await call_next(request)
        response.headers[Header.REQUEST_ID] = request_id
        if request.url.path.startswith(DOCS_PATH) or request.url.path == OPENAPI_PATH:
            response.headers["Content-Security-Policy"] = DOCS_CSP
        apply_security_headers(response.headers, settings)
        if request.url.path != HEALTH_PATH:
            log.info(
                "request",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "ms": int((perf_counter() - started) * 1000),
                },
            )
        return response
