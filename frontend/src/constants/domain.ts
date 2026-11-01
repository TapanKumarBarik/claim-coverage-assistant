// Domain values the code compares against or iterates, typed from the OpenAPI contract. Use `OUTCOME.BLOCKED`
// instead of "blocked", and `OUTCOMES` to loop. A value missing from (or unknown to) the contract is a compile
// error. Enums the UI only displays have no list here: they are covered, exhaustively, by the
// `Record<Enum, ...>` maps in labels.ts, tones.ts and glyphs.ts.
import type {
  BreakerState,
  CredentialSource,
  DocKind,
  ErrorCode,
  FeedbackFilter,
  GuardStage,
  Language,
  OpenAiAuth,
  Outcome,
  Rating,
  ResultKind,
  VersionStatus,
} from "../api/types";
import { enumOf } from "./enumOf";

export const LANGUAGE = enumOf<Language>()(["en", "fr"]);
export const LANGUAGES = Object.values(LANGUAGE);

export const RESULT_KIND = enumOf<ResultKind>()(["assessment", "reply"]);

export const DOC_KIND = enumOf<DocKind>()(["cg", "ipid", "brochure"]);
export const DOC_KINDS = Object.values(DOC_KIND);

export const VERSION_STATUS = enumOf<VersionStatus>()(["draft", "live", "withdrawn"]);

export const OUTCOME = enumOf<Outcome>()([
  "answered",
  "replied",
  "blocked",
  "rate_limited",
  "locked_out",
  "budget_exhausted",
  "error",
]);
export const OUTCOMES = Object.values(OUTCOME);

export const BREAKER_STATE = enumOf<BreakerState>()(["closed", "half_open", "open"]);

export const CREDENTIAL_SOURCE = enumOf<CredentialSource>()(["session", "server", "none"]);

export const ERROR_CODE = enumOf<ErrorCode>()([
  "invalid_input",
  "not_found",
  "conflict",
  "unauthorized",
  "forbidden",
  "credentials_required",
  "credentials_rejected",
  "payload_too_large",
  "rate_limited",
  "locked_out",
  "budget_exhausted",
  "guardrail_blocked",
  "unavailable",
  "not_configured",
  "upstream_error",
  "internal_error",
]);
export const ERROR_CODES = Object.values(ERROR_CODE);

export const GUARD_STAGE = enumOf<GuardStage>()(["input", "output"]);
export const GUARD_STAGES = Object.values(GUARD_STAGE);

export const RATING = enumOf<Rating>()(["up", "down"]);

export const FEEDBACK_FILTER = enumOf<FeedbackFilter>()(["up", "down", "unrated"]);
export const FEEDBACK_FILTERS = Object.values(FEEDBACK_FILTER);

export const OPENAI_AUTH = enumOf<OpenAiAuth>()(["api_key", "managed_identity"]);
