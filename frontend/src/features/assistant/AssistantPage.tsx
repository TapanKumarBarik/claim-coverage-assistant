import { useI18n } from "../../i18n/useI18n";
import { AsyncView } from "../../shared/AsyncView";
import { AssistantWorkspace } from "./AssistantWorkspace";
import { useContracts } from "./useContracts";

export function AssistantPage() {
  const { t } = useI18n();
  const { state, reload } = useContracts();
  return (
    <AsyncView
      state={state}
      isEmpty={({ contracts }) => contracts.length === 0}
      emptyLabel={t("form.noContracts")}
      errorMessage={t("form.loadError")}
      onRetry={reload}
    >
      {({ contracts, examples }) => <AssistantWorkspace contracts={contracts} examples={examples} />}
    </AsyncView>
  );
}
