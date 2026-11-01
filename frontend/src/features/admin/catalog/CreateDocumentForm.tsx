import { useState, type FormEvent } from "react";
import type { ContractAdmin, DocKind } from "../../../api/types";
import { DOC_KIND, DOC_KINDS } from "../../../constants/domain";
import { isOneOf } from "../../../constants/enumOf";
import { DOC_KIND_LABEL } from "../../../constants/labels";
import { useI18n } from "../../../i18n/useI18n";
import { contractName } from "../../../lib/contracts";
import { Button } from "../../../ui/Button";
import { Disclosure } from "../../../ui/Disclosure";
import { Field } from "../../../ui/Field";
import { Select } from "../../../ui/Select";
import { TextInput } from "../../../ui/TextInput";
import { useCatalog } from "./CatalogContext";
import "./catalog.css";

interface Values {
  contractId: string;
  id: string;
  title: string;
  kind: DocKind;
}

const EMPTY: Values = { contractId: "", id: "", title: "", kind: DOC_KIND.CG };

export function CreateDocumentForm({ contracts }: { contracts: readonly ContractAdmin[] }) {
  const { t } = useI18n();
  const { api, run } = useCatalog();
  const [values, setValues] = useState<Values>(EMPTY);
  const set = <K extends keyof Values>(field: K, value: Values[K]) => setValues((previous) => ({ ...previous, [field]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const created = await run(() =>
      api.createDocument({ contract_id: values.contractId, id: values.id, title: values.title, kind: values.kind }),
    );
    // Keep the contract and type selected: documents are usually added in batches.
    if (created) setValues({ ...values, id: "", title: "" });
  }

  return (
    <Disclosure summary={t("create.document")}>
      <form onSubmit={(event) => void submit(event)} className="catalog-form">
        <Field label={t("create.contractFor")}>
          <Select value={values.contractId} onChange={(event) => set("contractId", event.target.value)} required>
            <option value="" />
            {contracts.map((contract) => (
              <option key={contract.id} value={contract.id}>
                {contractName(contract)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("create.id")} hint={t("create.idHint")}>
          <TextInput value={values.id} onChange={(event) => set("id", event.target.value)} required />
        </Field>
        <Field label={t("create.docTitle")}>
          <TextInput value={values.title} onChange={(event) => set("title", event.target.value)} required />
        </Field>
        <Field label={t("create.kind")}>
          <Select
            value={values.kind}
            onChange={(event) => isOneOf(DOC_KINDS, event.target.value) && set("kind", event.target.value)}
          >
            {DOC_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(DOC_KIND_LABEL[kind])}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="primary">
          {t("action.create")}
        </Button>
      </form>
    </Disclosure>
  );
}
