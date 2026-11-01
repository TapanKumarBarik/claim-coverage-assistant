"""Runtime configuration from environment variables (or a local .env).

Secrets are ``SecretStr`` and only ever reach the process through the environment, where
App Service resolves Key Vault references. Nothing here has a secret default.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.constants import Environment, OpenAiAuth, ReasoningEffort

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: Environment = Environment.LOCAL
    log_level: str = "INFO"

    # --- storage -------------------------------------------------------------
    # On App Service (Linux) point STORAGE_DIR at /home/data/storage: /home persists.
    storage_dir: Path = BACKEND_DIR / "data" / "storage"
    data_dir: Path = BACKEND_DIR / "data"
    static_dir: Path = BACKEND_DIR / "app" / "static"

    # --- Azure OpenAI ----------------------------------------------------------
    azure_openai_endpoint: str | None = None
    azure_openai_api_key: SecretStr | None = None  # unset => Entra ID / managed identity
    azure_openai_api_version: str = "2025-04-01-preview"
    azure_openai_reasoning_deployment: str | None = None  # the thinking model
    azure_openai_fast_deployment: str | None = None  # small model; falls back to reasoning
    azure_openai_embedding_deployment: str | None = None
    reasoning_effort: ReasoningEffort | None = None  # only for models that support it
    fast_max_output_tokens: int = 600
    reasoning_max_output_tokens: int = 4000
    fast_timeout_s: float = 20.0
    reasoning_timeout_s: float = 90.0

    # --- bring-your-own credentials (visitor-supplied Azure OpenAI settings) -------------
    allow_byo_credentials: bool = True
    session_idle_ttl_s: float = 3600.0
    max_sessions: int = 500
    connect_rate_per_minute: int = 5
    azure_endpoint_allowed_suffixes: list[str] = [
        ".openai.azure.com",
        ".cognitiveservices.azure.com",
        ".services.ai.azure.com",
    ]

    # --- resilience ------------------------------------------------------------
    llm_retry_attempts: int = 3
    llm_retry_base_delay_s: float = 0.5
    llm_retry_max_delay_s: float = 8.0
    breaker_failure_threshold: int = 5
    breaker_reset_s: float = 30.0
    llm_max_concurrency: int = 4
    llm_queue_timeout_s: float = 5.0

    # --- agent harness ---------------------------------------------------------
    agent_max_steps: int = 3
    agent_max_tool_calls_per_step: int = 3
    agent_deadline_s: float = 120.0
    tool_timeout_s: float = 10.0
    tool_result_max_chars: int = 4000

    # --- admission control / abuse ------------------------------------------------
    analyze_rate_per_minute: int = 6
    client_daily_token_budget: int = 60_000
    global_daily_token_budget: int = 1_000_000
    abuse_strike_limit: int = 3
    abuse_window_s: float = 900.0
    abuse_lockout_s: float = 900.0
    max_claim_chars: int = 2000

    # --- admin & secrets -------------------------------------------------------
    admin_token_sha256: SecretStr | None = None  # SHA-256 hex of the admin token, never the token
    admin_auth_rate_per_minute: int = 10
    admin_session_idle_ttl_s: float = 1800.0  # signed out after this long without a request
    admin_session_max_age_s: float = 28_800.0  # and never later than this after signing in
    max_admin_sessions: int = 20
    max_upload_mb: int = 15
    privacy_salt: SecretStr | None = None  # pseudonymises client addresses in logs; random if unset

    # --- governance ------------------------------------------------------------
    governance_max_file_mb: int = 5

    # --- conversations and feedback ----------------------------------------------
    # Questions are stored with personal data masked, so admins can review answer quality. Both limits
    # apply: whichever is reached first removes the oldest conversations.
    conversation_retention_days: int = 30
    conversation_max_records: int = 2000
    feedback_rate_per_minute: int = 20

    # --- retrieval ---------------------------------------------------------------
    full_context_char_budget: int = 30_000
    retrieval_top_k: int = 12

    cors_origins: list[str] = []

    @property
    def openai_auth(self) -> OpenAiAuth:
        return OpenAiAuth.API_KEY if self.azure_openai_api_key else OpenAiAuth.MANAGED_IDENTITY

    @property
    def llm_configured(self) -> bool:
        has_auth = self.azure_openai_api_key is not None or self.app_env is Environment.PRODUCTION
        return bool(self.azure_openai_endpoint and self.azure_openai_reasoning_deployment and has_auth)

    @property
    def embeddings_configured(self) -> bool:
        return self.llm_configured and bool(self.azure_openai_embedding_deployment)

    def secret_values(self) -> list[str]:
        """Every configured secret, so logging can redact them if one ever leaks into a message."""
        fields = (self.azure_openai_api_key, self.admin_token_sha256, self.privacy_salt)
        return [secret.get_secret_value() for secret in fields if secret and secret.get_secret_value()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
