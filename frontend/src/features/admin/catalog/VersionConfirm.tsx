import { CATALOG_ACTION } from "./catalogActions";
import { CATALOG_ACTION_CONFIRM, CATALOG_ACTION_LABEL } from "./catalogActions";
import { useI18n } from "../../../i18n/useI18n";
import { ConfirmPanel } from "../../../ui/ConfirmPanel";
import { useCatalog } from "./CatalogContext";

/** The "are you sure?" step for activating, withdrawing or deleting the pending version. */
export function VersionConfirm() {
  const { t, format } = useI18n();
  const { pending, working, confirmPending, cancelConfirm } = useCatalog();
  if (!pending) return null;

  const { action, version } = pending;
  return (
    <ConfirmPanel
      title={t(CATALOG_ACTION_LABEL[action])}
      message={t(CATALOG_ACTION_CONFIRM[action], { label: version.label, date: format.date(version.effective_from) })}
      confirmLabel={t("action.confirm")}
      cancelLabel={t("action.cancel")}
      destructive={action !== CATALOG_ACTION.ACTIVATE}
      busy={working}
      onConfirm={() => void confirmPending()}
      onCancel={cancelConfirm}
    />
  );
}
