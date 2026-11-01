"""Builds model clients. One place decides how a connection becomes a resilient LLM."""

from __future__ import annotations

import httpx

from app.core.circuit_breaker import CircuitBreaker
from app.core.config import Settings
from app.core.ratelimit import ConcurrencyGate
from app.core.retry import RetryPolicy
from app.llm.azure import AzureConnection, AzureOpenAIClient, ModelTuning
from app.llm.port import LLM
from app.llm.resilient import ResilientLLM


class LlmFactory:
    """The retry policy, tuning and concurrency gate are shared; each connection gets its own
    circuit breaker, so one visitor's bad key can never trip the breaker for anyone else."""

    def __init__(self, settings: Settings, http_client: httpx.AsyncClient) -> None:
        self._settings = settings
        self._http = http_client
        self._tuning = ModelTuning.from_settings(settings)
        self._retry = RetryPolicy(
            settings.llm_retry_attempts, settings.llm_retry_base_delay_s, settings.llm_retry_max_delay_s
        )
        self._gate = ConcurrencyGate(settings.llm_max_concurrency, settings.llm_queue_timeout_s)

    def client(self, connection: AzureConnection) -> AzureOpenAIClient:
        return AzureOpenAIClient(connection, self._tuning, self._http)

    def wrap(self, inner: LLM) -> ResilientLLM:
        breaker = CircuitBreaker(
            failure_threshold=self._settings.breaker_failure_threshold, reset_s=self._settings.breaker_reset_s
        )
        return ResilientLLM(inner, retry=self._retry, breaker=breaker, gate=self._gate)
