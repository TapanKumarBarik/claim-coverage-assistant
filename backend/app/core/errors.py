"""Typed application errors. Each carries a stable code and the HTTP status it maps to."""

from __future__ import annotations

from typing import ClassVar

from app.core.constants import ErrorCode


class AppError(Exception):
    code: ClassVar[ErrorCode] = ErrorCode.INTERNAL
    status: ClassVar[int] = 500

    def __init__(self, message: str, *, retry_after: int | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.retry_after = retry_after


class InvalidInput(AppError):
    code = ErrorCode.INVALID_INPUT
    status = 422


class NotFound(AppError):
    code = ErrorCode.NOT_FOUND
    status = 404


class Conflict(AppError):
    code = ErrorCode.CONFLICT
    status = 409


class Unauthorized(AppError):
    code = ErrorCode.UNAUTHORIZED
    status = 401


class PayloadTooLarge(AppError):
    code = ErrorCode.PAYLOAD_TOO_LARGE
    status = 413


class RateLimited(AppError):
    code = ErrorCode.RATE_LIMITED
    status = 429


class LockedOut(RateLimited):
    code = ErrorCode.LOCKED_OUT


class BudgetExhausted(RateLimited):
    code = ErrorCode.BUDGET_EXHAUSTED


class GuardrailBlocked(AppError):
    code = ErrorCode.GUARDRAIL_BLOCKED
    status = 422


class Unavailable(AppError):
    code = ErrorCode.UNAVAILABLE
    status = 503


class NotConfigured(Unavailable):
    code = ErrorCode.NOT_CONFIGURED


class UpstreamError(AppError):
    code = ErrorCode.UPSTREAM_ERROR
    status = 502


class Forbidden(AppError):
    code = ErrorCode.FORBIDDEN
    status = 403


class CredentialsRequired(AppError):
    """No Azure OpenAI credentials are available for this visitor."""

    code = ErrorCode.CREDENTIALS_REQUIRED
    status = 428


class CredentialsRejected(AppError):
    """The endpoint or key a visitor supplied did not work."""

    code = ErrorCode.CREDENTIALS_REJECTED
    status = 422
