// Which message to show for each domain value. Typed against `MessageKey`, so a renamed or missing
// translation is a compile error, and typed against the contract enums, so a new value cannot be forgotten.
import type {
  CitationRole,
  Confidence,
  CredentialSource,
  DocKind,
  ErrorCode,
  GuardCode,
  GuardName,
  GuardStage,
  FeedbackFilter,
  Intent,
  Language,
  LimitPolicy,
  ModelTier,
  OpenAiAuth,
  Outcome,
  Rating,
  ReasoningEffort,
  SkillName,
  ToolName,
  Verdict,
  VersionStatus,
} from "../api/types";
import type { MessageKey } from "../i18n/messages";

export const VERDICT_LABEL: Record<Verdict, MessageKey> = {
  covered: "verdict.covered",
  not_covered: "verdict.not_covered",
  ambiguous: "verdict.ambiguous",
  needs_more_info: "verdict.needs_more_info",
  out_of_scope: "verdict.out_of_scope",
};

export const CONFIDENCE_LABEL: Record<Confidence, MessageKey> = {
  high: "confidence.high",
  medium: "confidence.medium",
  low: "confidence.low",
};

export const CITATION_ROLE_LABEL: Record<CitationRole, MessageKey> = {
  grants: "role.grants",
  excludes: "role.excludes",
  condition: "role.condition",
  limit: "role.limit",
};

export const DOC_KIND_LABEL: Record<DocKind, MessageKey> = {
  cg: "kind.cg",
  ipid: "kind.ipid",
  brochure: "kind.brochure",
};

export const DOC_KIND_TIP: Record<DocKind, MessageKey> = {
  cg: "kind.cg.tip",
  ipid: "kind.ipid.tip",
  brochure: "kind.brochure.tip",
};

/** Which sentence describes the best evidence found; `NO_EVIDENCE_STRENGTH_LABEL` when nothing was verified. */
export const EVIDENCE_STRENGTH_LABEL: Record<DocKind, MessageKey> = {
  cg: "strength.cg",
  ipid: "strength.ipid",
  brochure: "strength.brochure",
};
export const NO_EVIDENCE_STRENGTH_LABEL: MessageKey = "strength.none";

export const VERSION_STATUS_LABEL: Record<VersionStatus, MessageKey> = {
  draft: "status.draft",
  live: "status.live",
  withdrawn: "status.withdrawn",
};

export const OUTCOME_LABEL: Record<Outcome, MessageKey> = {
  answered: "outcome.answered",
  replied: "outcome.replied",
  blocked: "outcome.blocked",
  rate_limited: "outcome.rate_limited",
  locked_out: "outcome.locked_out",
  budget_exhausted: "outcome.budget_exhausted",
  error: "outcome.error",
};

export const INTENT_LABEL: Record<Intent, MessageKey> = {
  claim: "intent.claim",
  smalltalk: "intent.smalltalk",
  off_topic: "intent.off_topic",
  attack: "intent.attack",
};

export const MODEL_TIER_LABEL: Record<ModelTier, MessageKey> = {
  fast: "tier.fast",
  reasoning: "tier.reasoning",
};

export const CREDENTIAL_SOURCE_LABEL: Record<CredentialSource, MessageKey> = {
  session: "source.session",
  server: "source.server",
  none: "source.none",
};

export const GUARD_CODE_LABEL: Record<GuardCode, MessageKey> = {
  empty: "guardCode.empty",
  too_long: "guardCode.too_long",
  control_chars: "guardCode.control_chars",
  pii_redacted: "guardCode.pii_redacted",
  injection_pattern: "guardCode.injection_pattern",
  attack_intent: "guardCode.attack_intent",
  prompt_leak: "guardCode.prompt_leak",
  output_sanitized: "guardCode.output_sanitized",
  citation_dropped: "guardCode.citation_dropped",
  verdict_downgraded: "guardCode.verdict_downgraded",
};

export const GUARD_NAME_LABEL: Record<GuardName, MessageKey> = {
  text_normalizer: "guardName.text_normalizer",
  pii_redactor: "guardName.pii_redactor",
  injection_detector: "guardName.injection_detector",
  intent_classifier: "guardName.intent_classifier",
  prompt_leak_canary: "guardName.prompt_leak_canary",
  output_sanitizer: "guardName.output_sanitizer",
  citation_verifier: "guardName.citation_verifier",
};

export const GUARD_STAGE_LABEL: Record<GuardStage, MessageKey> = {
  input: "guardStage.input",
  output: "guardStage.output",
};

export const TOOL_LABEL: Record<ToolName, MessageKey> = {
  list_sections: "tool.list_sections",
  search_policy: "tool.search_policy",
  read_section: "tool.read_section",
};

export const SKILL_LABEL: Record<SkillName, MessageKey> = {
  concierge: "skill.concierge",
  query_rewrite: "skill.query_rewrite",
  coverage: "skill.coverage",
};

export const REASONING_EFFORT_LABEL: Record<ReasoningEffort, MessageKey> = {
  low: "effort.low",
  medium: "effort.medium",
  high: "effort.high",
};

export const OPENAI_AUTH_LABEL: Record<OpenAiAuth, MessageKey> = {
  api_key: "auth.api_key",
  managed_identity: "auth.managed_identity",
};

export const RATING_LABEL: Record<Rating, MessageKey> = {
  up: "rating.up",
  down: "rating.down",
};

export const FEEDBACK_FILTER_LABEL: Record<FeedbackFilter, MessageKey> = {
  up: "conv.filter.up",
  down: "conv.filter.down",
  unrated: "conv.filter.unrated",
};

export const LANGUAGE_NAME_LABEL: Record<Language, MessageKey> = {
  en: "lang.en",
  fr: "lang.fr",
};

/** One localized message per API error code (see shared/describeError.ts). */
export const ERROR_CODE_LABEL: Record<ErrorCode, MessageKey> = {
  invalid_input: "error.code.invalid_input",
  not_found: "error.code.not_found",
  conflict: "error.code.conflict",
  unauthorized: "error.code.unauthorized",
  forbidden: "error.code.forbidden",
  credentials_required: "error.code.credentials_required",
  credentials_rejected: "error.code.credentials_rejected",
  payload_too_large: "error.code.payload_too_large",
  rate_limited: "error.code.rate_limited",
  locked_out: "error.code.locked_out",
  budget_exhausted: "error.code.budget_exhausted",
  guardrail_blocked: "error.code.guardrail_blocked",
  unavailable: "error.code.unavailable",
  not_configured: "error.code.not_configured",
  upstream_error: "error.code.upstream_error",
  internal_error: "error.code.internal_error",
};

/** Labels for the limits table in the governance policy, one per field of `LimitPolicy`. */
export const LIMIT_LABEL: Record<keyof LimitPolicy, MessageKey> = {
  rate_per_minute: "gov.limit.rate_per_minute",
  client_daily_tokens: "gov.limit.client_daily_tokens",
  global_daily_tokens: "gov.limit.global_daily_tokens",
  strike_limit: "gov.limit.strike_limit",
  strike_window_s: "gov.limit.strike_window_s",
  lockout_s: "gov.limit.lockout_s",
  max_claim_chars: "gov.limit.max_claim_chars",
  llm_retry_attempts: "gov.limit.llm_retry_attempts",
  breaker_failure_threshold: "gov.limit.breaker_failure_threshold",
  breaker_reset_s: "gov.limit.breaker_reset_s",
  llm_max_concurrency: "gov.limit.llm_max_concurrency",
  agent_max_steps: "gov.limit.agent_max_steps",
  agent_deadline_s: "gov.limit.agent_deadline_s",
};

/** Limits whose value is a number of seconds (shown with a unit). */
export const LIMIT_IS_SECONDS: Readonly<Record<keyof LimitPolicy, boolean>> = {
  rate_per_minute: false,
  client_daily_tokens: false,
  global_daily_tokens: false,
  strike_limit: false,
  strike_window_s: true,
  lockout_s: true,
  max_claim_chars: false,
  llm_retry_attempts: false,
  breaker_failure_threshold: false,
  breaker_reset_s: true,
  llm_max_concurrency: false,
  agent_max_steps: false,
  agent_deadline_s: true,
};
