import { ApiError } from "../../../api/errors";
import { ERROR_CODE } from "../../../constants/domain";
import type { Translate } from "../../../i18n/translate";
import { describeError } from "../../../shared/describeError";

/** Sign-in has its own wording for the few codes that mean "wrong password", "slow down" and "admin disabled". */
export function describeLoginError(t: Translate, error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case ERROR_CODE.UNAUTHORIZED:
        return t("admin.login.invalid");
      case ERROR_CODE.RATE_LIMITED:
      case ERROR_CODE.LOCKED_OUT:
        return t("admin.login.throttled");
      case ERROR_CODE.NOT_CONFIGURED:
        return t("admin.login.disabled");
    }
  }
  return describeError(t, error);
}
