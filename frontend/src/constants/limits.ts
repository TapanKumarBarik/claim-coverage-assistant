import { LANGUAGE } from "./domain";

/** The API accepts up to 4000 characters; the composer stays shorter to keep claims focused. */
export const MAX_CLAIM_CHARS = 2000;
/** The character counter appears once a message reaches this share of the limit. */
export const COUNTER_VISIBLE_RATIO = 0.8;
/** The conversation lives in memory only; the oldest exchanges are dropped past this many. */
export const MAX_TURNS = 40;

export const MAX_VERSION_LABEL_CHARS = 60;
export const UPLOAD_ACCEPT = ".pdf,.md,.txt,application/pdf,text/markdown,text/plain";

/** Mirrors the API's comment limit; the box stops here instead of failing on submit. */
export const FEEDBACK_COMMENT_MAX_CHARS = 500;
export const CONVERSATIONS_PAGE_SIZE = 25;
/** The search box waits this long after the last keystroke before asking the server. */
export const SEARCH_DEBOUNCE_MS = 300;

export const AUDIT_LIMIT = 100;
export const EVENTS_LIMIT = 100;
export const DEFAULT_WINDOW_HOURS = 24;
/** The governance overview flags the token budget once this share is used... */
export const HEALTH_BUDGET_WARN_RATIO = 0.8;
/** ...and the citation check once fewer than this share of quoted clauses could be verified. */
export const HEALTH_CITATION_FLOOR = 0.8;

/** The contract form has no country or language field: new contracts are Luxembourg / French. */
export const DEFAULT_CONTRACT_COUNTRY = "LU";
export const DEFAULT_CONTRACT_LANGUAGE = LANGUAGE.FR;

export const MS_PER_MINUTE = 60_000;
export const MS_PER_SECOND = 1000;
