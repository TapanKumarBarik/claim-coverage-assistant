import { ASYNC_STATUS } from "../../constants/async";
import { DEFAULT_WINDOW_HOURS } from "../../constants/limits";
import { useResource } from "../../hooks/useResource";
import { useI18n } from "../../i18n/useI18n";
import { useAdminApi } from "./adminContext";

/** "Global token budget: X of Y", read from the governance summary. Hidden while loading or if it fails. */
export function UsageLine() {
  const { t, format } = useI18n();
  const api = useAdminApi();
  const { state } = useResource(() => api.governanceSummary(DEFAULT_WINDOW_HOURS), [api]);
  if (state.status !== ASYNC_STATUS.READY) return null;

  const { global_used, global_limit } = state.data.budgets;
  return <span className="muted">{t("admin.usage", { used: format.number(global_used), limit: format.number(global_limit) })}</span>;
}
