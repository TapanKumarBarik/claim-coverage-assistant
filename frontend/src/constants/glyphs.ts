import type { Verdict } from "../api/types";

/** The verdict is never conveyed by colour alone: every verdict has its own glyph and text. */
export const VERDICT_GLYPH: Record<Verdict, string> = {
  covered: "✓",
  not_covered: "✕",
  ambiguous: "?",
  needs_more_info: "…",
  out_of_scope: "–",
};

export const PINNED_GLYPH = "📌";
export const EM_DASH = "—";
export const MIDDLE_DOT = "·";
