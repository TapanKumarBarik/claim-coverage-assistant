"""Every identifier the system compares, stores or sends lives here as an enum.

Nothing else in the code base should spell these values as bare strings.
"""

from __future__ import annotations

from enum import StrEnum

API_PREFIX = "/api"
ADMIN_PREFIX = f"{API_PREFIX}/admin"
GLOBAL_KEY = "*"  # meter key for totals across all clients
REQUEST_ID_PATTERN = r"^[A-Za-z0-9-]{8,64}$"  # the shape of a request id the server issues or accepts back


class Environment(StrEnum):
    LOCAL = "local"
    TEST = "test"
    PRODUCTION = "production"


class Language(StrEnum):
    EN = "en"
    FR = "fr"


class Tag(StrEnum):
    """OpenAPI tags."""

    PUBLIC = "public"
    ADMIN = "admin"
    CONVERSATIONS = "conversations"
    GOVERNANCE = "governance"
    SESSION = "session"


class Header(StrEnum):
    REQUEST_ID = "X-Request-ID"
    RETRY_AFTER = "Retry-After"
    AUTHORIZATION = "Authorization"
    FORWARDED_FOR = "X-Forwarded-For"
    CONTENT_TYPE = "Content-Type"
    ORIGIN = "Origin"
    HOST = "Host"


class ErrorCode(StrEnum):
    INVALID_INPUT = "invalid_input"
    NOT_FOUND = "not_found"
    CONFLICT = "conflict"
    UNAUTHORIZED = "unauthorized"
    FORBIDDEN = "forbidden"
    CREDENTIALS_REQUIRED = "credentials_required"
    CREDENTIALS_REJECTED = "credentials_rejected"
    PAYLOAD_TOO_LARGE = "payload_too_large"
    RATE_LIMITED = "rate_limited"
    LOCKED_OUT = "locked_out"
    BUDGET_EXHAUSTED = "budget_exhausted"
    GUARDRAIL_BLOCKED = "guardrail_blocked"
    UNAVAILABLE = "unavailable"
    NOT_CONFIGURED = "not_configured"
    UPSTREAM_ERROR = "upstream_error"
    INTERNAL = "internal_error"


# --- AI vocabulary ---------------------------------------------------------


class ModelTier(StrEnum):
    """FAST: small, cheap model for routing and small talk. REASONING: the thinking model."""

    FAST = "fast"
    REASONING = "reasoning"


class ReasoningEffort(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class OpenAiAuth(StrEnum):
    API_KEY = "api_key"
    MANAGED_IDENTITY = "managed_identity"


class CredentialSource(StrEnum):
    SESSION = "session"  # supplied by the visitor, held in server memory
    SERVER = "server"  # configured by the operator through the environment
    NONE = "none"


class Intent(StrEnum):
    CLAIM = "claim"
    SMALLTALK = "smalltalk"
    OFF_TOPIC = "off_topic"
    ATTACK = "attack"


class Verdict(StrEnum):
    COVERED = "covered"
    NOT_COVERED = "not_covered"
    AMBIGUOUS = "ambiguous"
    NEEDS_MORE_INFO = "needs_more_info"
    OUT_OF_SCOPE = "out_of_scope"


class Confidence(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class CitationRole(StrEnum):
    GRANTS = "grants"
    EXCLUDES = "excludes"
    CONDITION = "condition"
    LIMIT = "limit"


class RetrievalMode(StrEnum):
    FULL_CONTEXT = "full_context"
    HYBRID = "hybrid"
    KEYWORD = "keyword"


class ResponseKind(StrEnum):
    ASSESSMENT = "assessment"
    REPLY = "reply"


class Rating(StrEnum):
    """A visitor's verdict on one answer."""

    UP = "up"
    DOWN = "down"


class FeedbackFilter(StrEnum):
    """Which conversations the admin list shows, by feedback."""

    UP = "up"
    DOWN = "down"
    UNRATED = "unrated"


class SkillName(StrEnum):
    CONCIERGE = "concierge"
    QUERY_REWRITE = "query_rewrite"
    COVERAGE = "coverage"


class ToolName(StrEnum):
    LIST_SECTIONS = "list_sections"
    SEARCH_POLICY = "search_policy"
    READ_SECTION = "read_section"


class Outcome(StrEnum):
    ANSWERED = "answered"
    REPLIED = "replied"
    BLOCKED = "blocked"
    RATE_LIMITED = "rate_limited"
    LOCKED_OUT = "locked_out"
    BUDGET_EXHAUSTED = "budget_exhausted"
    ERROR = "error"


class GuardName(StrEnum):
    NORMALIZER = "text_normalizer"
    PII_REDACTOR = "pii_redactor"
    INJECTION_DETECTOR = "injection_detector"
    INTENT_CLASSIFIER = "intent_classifier"
    CANARY = "prompt_leak_canary"
    SANITIZER = "output_sanitizer"
    CITATION_VERIFIER = "citation_verifier"


class GuardCode(StrEnum):
    EMPTY = "empty"
    TOO_LONG = "too_long"
    CONTROL_CHARS = "control_chars"
    PII_REDACTED = "pii_redacted"
    INJECTION_PATTERN = "injection_pattern"
    ATTACK_INTENT = "attack_intent"
    PROMPT_LEAK = "prompt_leak"
    OUTPUT_SANITIZED = "output_sanitized"
    CITATION_DROPPED = "citation_dropped"
    VERDICT_DOWNGRADED = "verdict_downgraded"


class GuardStage(StrEnum):
    INPUT = "input"
    OUTPUT = "output"


class HealthStatus(StrEnum):
    OK = "ok"


class BreakerState(StrEnum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"
