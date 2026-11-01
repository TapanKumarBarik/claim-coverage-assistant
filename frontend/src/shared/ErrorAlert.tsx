import { ApiError } from "../api/errors";
import { useI18n } from "../i18n/useI18n";
import { Alert } from "../ui/Alert";
import { TONE } from "../constants/tone";
import { describeError } from "./describeError";

interface Props {
  error: unknown;
  /** Replaces the generated message (for a failure that deserves more specific wording). */
  message?: string;
}

/** A user-facing error: localized message plus the support reference when the server gave one. */
export function ErrorAlert({ error, message }: Props) {
  const { t } = useI18n();
  const requestId = error instanceof ApiError ? error.requestId : null;
  return (
    <Alert tone={TONE.DANGER}>
      <p>{message ?? describeError(t, error)}</p>
      {requestId && <p className="muted small">{t("error.ref", { id: requestId })}</p>}
    </Alert>
  );
}
