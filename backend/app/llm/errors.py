"""Failures of the model layer, split by what the caller should do about them."""

from __future__ import annotations

from app.core.errors import AppError, GuardrailBlocked, NotConfigured, Unavailable, UpstreamError

TRY_AGAIN_AFTER_S = 30


class LLMError(Exception):
    """The call failed in a way retrying will not fix."""


class LLMTransientError(LLMError):
    """Rate limit, timeout, connectivity or 5xx: safe to retry."""

    def __init__(self, message: str, *, retry_after: float | None = None) -> None:
        super().__init__(message)
        self.retry_after = retry_after


class LLMRefusal(LLMError):
    """The model or the provider's content filter declined to answer."""


class LLMConfigError(LLMError):
    """Authentication, authorisation or deployment misconfiguration."""


def to_app_error(exc: LLMError) -> AppError:
    """The one place model-layer failures become user-facing errors."""
    if isinstance(exc, LLMTransientError):
        return Unavailable(
            "The language model is busy right now. Please try again in a moment.",
            retry_after=TRY_AGAIN_AFTER_S,
        )
    if isinstance(exc, LLMRefusal):
        return GuardrailBlocked("This message could not be processed. Please rephrase it.")
    if isinstance(exc, LLMConfigError):
        return NotConfigured("The language model is not configured correctly.")
    return UpstreamError("The analysis could not be completed.")
