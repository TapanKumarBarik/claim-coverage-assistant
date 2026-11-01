import type { ContractPublic } from "../../api/types";
import { useI18n } from "../../i18n/useI18n";
import { contractName } from "../../lib/contracts";
import { Select } from "../../ui/Select";
import { VisuallyHidden } from "../../ui/VisuallyHidden";

interface Props {
  contracts: readonly ContractPublic[];
  value: string;
  onChange: (contractId: string) => void;
}

/** The contract the answer is based on. Compact: its name is the visible text, "Contract" is for assistive technology. */
export function ContractPicker({ contracts, value, onChange }: Props) {
  const { t } = useI18n();
  return (
    <label className="composer__option composer__option--grow">
      <VisuallyHidden>{t("form.contract")}</VisuallyHidden>
      <Select className="composer__control" value={value} onChange={(event) => onChange(event.target.value)}>
        {contracts.map((contract) => (
          <option key={contract.id} value={contract.id}>
            {contractName(contract)}
            {contract.synthetic ? ` (${t("form.contractFictional")})` : ""}
          </option>
        ))}
      </Select>
    </label>
  );
}
