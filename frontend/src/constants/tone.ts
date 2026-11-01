/** The five visual tones shared by pills, alerts and banners. The colours live in styles/tokens.css. */
export const TONE = { NEUTRAL: "neutral", OK: "ok", WARNING: "warning", DANGER: "danger", INFO: "info" } as const;
export type Tone = (typeof TONE)[keyof typeof TONE];
