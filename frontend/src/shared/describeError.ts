import { ApiError, NetworkError } from "../api/errors";
import type { ErrorCode } from "../api/types";
import { ERROR_CODE } from "../constants/domain";
import { ERROR_CODE_LABEL } from "../constants/labels";
import type { MessageKey } from "../i18n/messages";
import type { Translate } from "../i18n/translate";

/** Codes whose message can say how long to wait, when the server sent `Retry-After`. */
const MESSAGE_WITH_WAIT: Partial<Record<ErrorCode, MessageKey>> = {
  [ERROR_CODE.RATE_LIMITED]: "error.code.rate_limited.wait",
  [ERROR_CODE.LOCKED_OUT]: "error.code.locked_out.wait",
};

/**
 * The one place an error becomes text for the user, in their language. It never shows a stack trace,
 * an HTTP status, or (for a blocked message) any text the server sent back.
 *
 *   network failure  -> its own message
 *   known `code`     -> the localized message for that code
 *   no usable code   -> the server's `detail`, else a generic message
 */
export function describeError(t: Translate, error: unknown): string {
  if (error instanceof NetworkError) return t("error.network");
  if (!(error instanceof ApiError)) return t("error.unknown");

  const { code, detail, retryAfter } = error;
  if (code === null) return detail ? t("error.withDetail", { detail }) : t("error.unknown");

  const waitMessage = MESSAGE_WITH_WAIT[code];
  if (waitMessage && retryAfter !== null) return t(waitMessage, { seconds: retryAfter });
  // Validation details are the one server text worth showing: they say which field is wrong.
  if (code === ERROR_CODE.INVALID_INPUT && detail) return t("error.code.invalid_input.detail", { detail });
  return t(ERROR_CODE_LABEL[code]);
}
