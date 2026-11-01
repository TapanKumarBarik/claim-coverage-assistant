import type { ContractAdmin } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { contractName } from "../../../lib/contracts";
import { Card } from "../../../ui/Card";
import { Pill } from "../../../ui/Pill";
import { DocumentSection } from "./DocumentSection";

export function ContractCard({ contract }: { contract: ContractAdmin }) {
  const { t } = useI18n();
  return (
    <Card title={<>{contractName(contract)} {contract.synthetic && <Pill>{t("admin.synthetic")}</Pill>}</>}>
      <p className="muted">
        <code>{contract.id}</code>
      </p>
      {contract.documents.map((doc) => (
        <DocumentSection key={doc.id} doc={doc} />
      ))}
    </Card>
  );
}
