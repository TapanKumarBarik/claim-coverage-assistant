// How each domain value is coloured. One map per enum, exhaustive by construction (`Record<Enum, Tone>`).
import type {
  CitationRole,
  Confidence,
  CredentialSource,
  DocKind,
  GuardCode,
  Outcome,
  Rating,
  Verdict,
  VersionStatus,
} from "../api/types";
import { TONE, type Tone } from "./tone";

export const VERDICT_TONE: Record<Verdict, Tone> = {
  covered: TONE.OK,
  not_covered: TONE.DANGER,
  ambiguous: TONE.WARNING,
  needs_more_info: TONE.INFO,
  out_of_scope: TONE.NEUTRAL,
};

export const CONFIDENCE_TONE: Record<Confidence, Tone> = {
  high: TONE.OK,
  medium: TONE.WARNING,
  low: TONE.DANGER,
};

export const CITATION_ROLE_TONE: Record<CitationRole, Tone> = {
  grants: TONE.OK,
  excludes: TONE.DANGER,
  condition: TONE.WARNING,
  limit: TONE.INFO,
};

export const DOC_KIND_TONE: Record<DocKind, Tone> = {
  cg: TONE.INFO,
  ipid: TONE.NEUTRAL,
  brochure: TONE.NEUTRAL,
};

export const VERSION_STATUS_TONE: Record<VersionStatus, Tone> = {
  live: TONE.OK,
  draft: TONE.WARNING,
  withdrawn: TONE.DANGER,
};

export const OUTCOME_TONE: Record<Outcome, Tone> = {
  answered: TONE.OK,
  replied: TONE.INFO,
  blocked: TONE.DANGER,
  rate_limited: TONE.WARNING,
  locked_out: TONE.DANGER,
  budget_exhausted: TONE.WARNING,
  error: TONE.DANGER,
};

export const RATING_TONE: Record<Rating, Tone> = {
  up: TONE.OK,
  down: TONE.DANGER,
};

/** Hostile input is red, a safeguard that changed the answer is amber, routine tidying is quiet. */
export const GUARD_CODE_TONE: Record<GuardCode, Tone> = {
  empty: TONE.NEUTRAL,
  too_long: TONE.NEUTRAL,
  control_chars: TONE.NEUTRAL,
  pii_redacted: TONE.INFO,
  injection_pattern: TONE.DANGER,
  attack_intent: TONE.DANGER,
  prompt_leak: TONE.DANGER,
  output_sanitized: TONE.WARNING,
  citation_dropped: TONE.WARNING,
  verdict_downgraded: TONE.WARNING,
};

export const CREDENTIAL_SOURCE_TONE: Record<CredentialSource, Tone> = {
  session: TONE.OK,
  server: TONE.INFO,
  none: TONE.WARNING,
};
