"""Azure OpenAI adapter: one client serving both model tiers and embeddings."""

from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

import httpx
import numpy as np
import openai
from pydantic import SecretStr

from app.core.config import Settings
from app.core.constants import ModelTier, ReasoningEffort
from app.llm.errors import LLMConfigError, LLMError, LLMRefusal, LLMTransientError
from app.llm.port import M
from app.llm.types import ChatMessage, ChatTurn, Role, ToolCall, ToolSpec, Usage

log = logging.getLogger(__name__)

COGNITIVE_SERVICES_SCOPE = "https://cognitiveservices.azure.com/.default"
CONTENT_FILTER_MARKER = "content_filter"
RETRY_AFTER_HEADER = "retry-after"
EMBED_BATCH_SIZE = 64
HTTP_SERVER_ERROR = 500
FUNCTION_TOOL = "function"


@dataclass(frozen=True)
class AzureConnection:
    """Where and how to reach one Azure OpenAI resource. Held in memory only."""

    endpoint: str
    api_key: SecretStr | None  # None => Entra ID / managed identity
    api_version: str
    reasoning_deployment: str
    fast_deployment: str | None = None
    embedding_deployment: str | None = None

    @classmethod
    def from_settings(cls, settings: Settings) -> AzureConnection | None:
        if not settings.llm_configured:
            return None
        assert settings.azure_openai_endpoint and settings.azure_openai_reasoning_deployment
        return cls(
            endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            api_version=settings.azure_openai_api_version,
            reasoning_deployment=settings.azure_openai_reasoning_deployment,
            fast_deployment=settings.azure_openai_fast_deployment,
            embedding_deployment=settings.azure_openai_embedding_deployment,
        )


@dataclass(frozen=True)
class ModelTuning:
    """Per-tier limits; the same for every connection."""

    fast_max_output_tokens: int
    reasoning_max_output_tokens: int
    fast_timeout_s: float
    reasoning_timeout_s: float
    reasoning_effort: ReasoningEffort | None

    @classmethod
    def from_settings(cls, settings: Settings) -> ModelTuning:
        return cls(
            settings.fast_max_output_tokens,
            settings.reasoning_max_output_tokens,
            settings.fast_timeout_s,
            settings.reasoning_timeout_s,
            settings.reasoning_effort,
        )


@dataclass(frozen=True)
class ModelProfile:
    deployment: str
    max_output_tokens: int
    timeout_s: float
    reasoning_effort: ReasoningEffort | None


def build_profiles(connection: AzureConnection, tuning: ModelTuning) -> dict[ModelTier, ModelProfile]:
    """Two tiers: a thinking model for analysis and a small model for routing and small talk."""
    fast = connection.fast_deployment or connection.reasoning_deployment  # one deployment can serve both
    return {
        ModelTier.FAST: ModelProfile(fast, tuning.fast_max_output_tokens, tuning.fast_timeout_s, None),
        ModelTier.REASONING: ModelProfile(
            connection.reasoning_deployment,
            tuning.reasoning_max_output_tokens,
            tuning.reasoning_timeout_s,
            tuning.reasoning_effort,
        ),
    }


def _to_wire(message: ChatMessage) -> dict[str, Any]:
    wire: dict[str, Any] = {"role": message.role.value}
    if message.content is not None:
        wire["content"] = message.content
    if message.tool_calls:
        wire["tool_calls"] = [
            {"id": c.id, "type": FUNCTION_TOOL, "function": {"name": c.name, "arguments": c.arguments}}
            for c in message.tool_calls
        ]
    if message.tool_call_id is not None:
        wire["tool_call_id"] = message.tool_call_id
    return wire


def _tool_to_wire(spec: ToolSpec) -> dict[str, Any]:
    return {
        "type": FUNCTION_TOOL,
        "function": {"name": spec.name, "description": spec.description, "parameters": spec.parameters},
    }


def new_http_client() -> httpx.AsyncClient:
    """One pooled client for every Azure connection. Redirects are refused so a hostile or
    misconfigured endpoint cannot bounce a request (and its API key) to another host."""
    return httpx.AsyncClient(follow_redirects=False, timeout=httpx.Timeout(120.0, connect=10.0))


def _retry_after(exc: openai.APIStatusError) -> float | None:
    try:
        return float(exc.response.headers.get(RETRY_AFTER_HEADER, ""))
    except ValueError:
        return None


class AzureOpenAIClient:
    def __init__(
        self, connection: AzureConnection, tuning: ModelTuning, http_client: httpx.AsyncClient
    ) -> None:
        self._profiles = build_profiles(connection, tuning)
        self._embedding_deployment = connection.embedding_deployment

        kwargs: dict[str, Any] = {
            "azure_endpoint": connection.endpoint,
            "api_version": connection.api_version,
            "max_retries": 0,  # retries are our policy (ResilientLLM), not the SDK's
            "http_client": http_client,  # shared; never follows redirects (see new_http_client)
        }
        if connection.api_key is not None:
            kwargs["api_key"] = connection.api_key.get_secret_value()
        else:  # managed identity / developer login: no secret to store at all
            from azure.identity import DefaultAzureCredential, get_bearer_token_provider

            kwargs["azure_ad_token_provider"] = get_bearer_token_provider(
                DefaultAzureCredential(), COGNITIVE_SERVICES_SCOPE
            )
        self._client = openai.AsyncAzureOpenAI(**kwargs)

    @property
    def can_embed(self) -> bool:
        return bool(self._embedding_deployment)

    def model_for(self, tier: ModelTier) -> str:
        return self._profiles[tier].deployment

    async def chat(
        self,
        *,
        tier: ModelTier,
        messages: Sequence[ChatMessage],
        tools: Sequence[ToolSpec] = (),
        response_model: type[M] | None = None,
    ) -> ChatTurn[M]:
        profile = self._profiles[tier]
        request: dict[str, Any] = {
            "model": profile.deployment,
            "messages": [_to_wire(m) for m in messages],
            "max_completion_tokens": profile.max_output_tokens,
            "timeout": profile.timeout_s,
        }
        if profile.reasoning_effort is not None:
            request["reasoning_effort"] = profile.reasoning_effort.value
        if tools:
            request["tools"] = [_tool_to_wire(t) for t in tools]

        try:
            if response_model is not None:
                completion = await self._client.chat.completions.parse(
                    response_format=response_model, **request
                )
            else:
                completion = await self._client.chat.completions.create(**request)
        except openai.BadRequestError as exc:
            if CONTENT_FILTER_MARKER in str(exc).lower():
                raise LLMRefusal("Blocked by the provider's content filter.") from exc
            log.error("llm_bad_request", extra={"error": str(exc)[:500]})
            raise LLMError("The model rejected the request.") from exc
        except (openai.RateLimitError, openai.APITimeoutError, openai.APIConnectionError) as exc:
            retry_after = _retry_after(exc) if isinstance(exc, openai.APIStatusError) else None
            raise LLMTransientError("The model is temporarily unavailable.", retry_after=retry_after) from exc
        except (openai.AuthenticationError, openai.PermissionDeniedError, openai.NotFoundError) as exc:
            log.error("llm_configuration_error", extra={"error": str(exc)[:500]})
            raise LLMConfigError("The model deployment is misconfigured.") from exc
        except openai.APIStatusError as exc:
            if exc.status_code >= HTTP_SERVER_ERROR:
                raise LLMTransientError(
                    "The model returned a server error.", retry_after=_retry_after(exc)
                ) from exc
            raise LLMError(f"Model error ({exc.status_code}).") from exc

        message = completion.choices[0].message
        if message.refusal:
            raise LLMRefusal(message.refusal)
        usage = completion.usage
        return ChatTurn(
            message=ChatMessage(
                role=Role.ASSISTANT,
                content=message.content,
                tool_calls=tuple(
                    ToolCall(id=c.id, name=c.function.name, arguments=c.function.arguments)
                    for c in (message.tool_calls or [])
                    if c.type == FUNCTION_TOOL
                ),
            ),
            parsed=getattr(message, "parsed", None),
            usage=Usage(
                prompt_tokens=usage.prompt_tokens if usage else 0,
                completion_tokens=usage.completion_tokens if usage else 0,
            ),
            model=profile.deployment,
        )

    async def embed(self, texts: Sequence[str]) -> np.ndarray:
        if not self._embedding_deployment:
            raise LLMConfigError("No embedding deployment is configured.")
        vectors: list[list[float]] = []
        try:
            for start in range(0, len(texts), EMBED_BATCH_SIZE):
                batch = list(texts[start : start + EMBED_BATCH_SIZE])
                response = await self._client.embeddings.create(model=self._embedding_deployment, input=batch)
                vectors.extend(item.embedding for item in response.data)
        except (openai.RateLimitError, openai.APITimeoutError, openai.APIConnectionError) as exc:
            raise LLMTransientError("The embedding service is temporarily unavailable.") from exc
        except openai.APIError as exc:
            raise LLMError("The embedding service returned an error.") from exc
        matrix = np.asarray(vectors, dtype=np.float32)
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        return np.asarray(matrix / np.clip(norms, 1e-12, None), dtype=np.float32)
