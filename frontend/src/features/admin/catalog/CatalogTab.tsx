import type { Catalog } from "../../../api/types";
import { useResource } from "../../../hooks/useResource";
import { useI18n } from "../../../i18n/useI18n";
import { AsyncView } from "../../../shared/AsyncView";
import { ErrorAlert } from "../../../shared/ErrorAlert";
import { EmptyState } from "../../../ui/EmptyState";
import { useAdminApi } from "../adminContext";
import { CatalogContext } from "./CatalogContext";
import { ContractCard } from "./ContractCard";
import { CreateContractForm } from "./CreateContractForm";
import { CreateDocumentForm } from "./CreateDocumentForm";
import { useCatalogState } from "./useCatalogState";
import "./catalog.css";

function CatalogView({ catalog, reload }: { catalog: Catalog; reload: () => void }) {
  const { t } = useI18n();
  const api = useAdminApi();
  const state = useCatalogState(api, reload);
  return (
    <CatalogContext.Provider value={state}>
      <div className="stack">
        {state.error && <ErrorAlert error={state.error} />}
        {catalog.contracts.length === 0 && <EmptyState>{t("admin.empty")}</EmptyState>}
        {catalog.contracts.map((contract) => (
          <ContractCard key={contract.id} contract={contract} />
        ))}
        <div>
          <CreateContractForm />
          <CreateDocumentForm contracts={catalog.contracts} />
        </div>
      </div>
    </CatalogContext.Provider>
  );
}

/** Contracts, their documents and versions: upload a draft, review what changed, activate it. */
export function CatalogTab() {
  const api = useAdminApi();
  const { state, reload } = useResource(api.catalog, [api]);
  return (
    <AsyncView state={state} onRetry={reload}>
      {(catalog) => <CatalogView catalog={catalog} reload={reload} />}
    </AsyncView>
  );
}
