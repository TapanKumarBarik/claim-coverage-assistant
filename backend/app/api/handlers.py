"""One error shape for every failure: ``{code, detail, request_id}``."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.constants import ErrorCode, Header
from app.core.errors import AppError

log = logging.getLogger(__name__)

_CODE_BY_STATUS: dict[int, ErrorCode] = {
    401: ErrorCode.UNAUTHORIZED,
    403: ErrorCode.FORBIDDEN,
    404: ErrorCode.NOT_FOUND,
    409: ErrorCode.CONFLICT,
    413: ErrorCode.PAYLOAD_TOO_LARGE,
    429: ErrorCode.RATE_LIMITED,
}
INTERNAL_MESSAGE = "Internal error."
VALIDATION_FALLBACK = "Invalid request."


def error_response(
    request: Request, *, code: ErrorCode, detail: str, status: int, retry_after: int | None = None
) -> JSONResponse:
    headers = {Header.RETRY_AFTER.value: str(retry_after)} if retry_after else None
    body = {"code": code, "detail": detail, "request_id": getattr(request.state, "request_id", None)}
    return JSONResponse(body, status_code=status, headers=headers)


def install_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error(request: Request, exc: AppError) -> JSONResponse:
        return error_response(
            request, code=exc.code, detail=exc.message, status=exc.status, retry_after=exc.retry_after
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        problems = "; ".join(str(e.get("msg", "")) for e in exc.errors()[:3]) or VALIDATION_FALLBACK
        return error_response(request, code=ErrorCode.INVALID_INPUT, detail=problems, status=422)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _CODE_BY_STATUS.get(exc.status_code, ErrorCode.INVALID_INPUT)
        return error_response(request, code=code, detail=str(exc.detail), status=exc.status_code)

    @app.exception_handler(Exception)
    async def unexpected(request: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled_error")
        return error_response(request, code=ErrorCode.INTERNAL, detail=INTERNAL_MESSAGE, status=500)
