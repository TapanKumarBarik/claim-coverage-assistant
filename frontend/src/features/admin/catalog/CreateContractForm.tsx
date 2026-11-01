import { useState, type FormEvent } from "react";
import { DEFAULT_CONTRACT_COUNTRY, DEFAULT_CONTRACT_LANGUAGE } from "../../../constants/limits";
import { useI18n } from "../../../i18n/useI18n";
import { Button } from "../../../ui/Button";
import { Disclosure } from "../../../ui/Disclosure";
import { Field } from "../../../ui/Field";
import { TextInput } from "../../../ui/TextInput";
import { useCatalog } from "./CatalogContext";
import "./catalog.css";

const EMPTY = { id: "", insurer: "", product: "" };

export function CreateContractForm() {
  const { t } = useI18n();
  const { api, run } = useCatalog();
  const [values, setValues] = useState(EMPTY);
  const bind = (field: keyof typeof EMPTY) => ({
    value: values[field],
    onChange: (event: { target: { value: string } }) => setValues((previous) => ({ ...previous, [field]: event.target.value })),
    required: true,
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const created = await run(() => api.createContract({ ...values, country: DEFAULT_CONTRACT_COUNTRY, language: DEFAULT_CONTRACT_LANGUAGE }));
    if (created) setValues(EMPTY);
  }

  return (
    <Disclosure summary={t("create.contract")}>
      <form onSubmit={(event) => void submit(event)} className="catalog-form">
        <Field label={t("create.id")} hint={t("create.idHint")}>
          <TextInput {...bind("id")} />
        </Field>
        <Field label={t("create.insurer")}>
          <TextInput {...bind("insurer")} />
        </Field>
        <Field label={t("create.product")}>
          <TextInput {...bind("product")} />
        </Field>
        <Button type="submit" variant="primary">
          {t("action.create")}
        </Button>
      </form>
    </Disclosure>
  );
}
