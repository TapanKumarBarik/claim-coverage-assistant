import { useRef, useState, type FormEvent } from "react";
import { MAX_VERSION_LABEL_CHARS, UPLOAD_ACCEPT } from "../../../constants/limits";
import { useI18n } from "../../../i18n/useI18n";
import { todayIso } from "../../../lib/dates";
import { Button } from "../../../ui/Button";
import { Disclosure } from "../../../ui/Disclosure";
import { Field } from "../../../ui/Field";
import { TextInput } from "../../../ui/TextInput";
import { useCatalog } from "./CatalogContext";
import "./catalog.css";

/** Upload a new version of a document as a draft. It has no effect until someone activates it. */
export function UploadForm({ documentId }: { documentId: string }) {
  const { t } = useI18n();
  const { api, run, setUploaded } = useCatalog();
  const form = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    const version = await run(() => api.upload(documentId, { file, label: label.trim(), effectiveFrom }));
    setBusy(false);
    if (!version) return;
    setUploaded({ documentId, version });
    setFile(null);
    setLabel("");
    form.current?.reset();
  }

  return (
    <Disclosure summary={t("upload.title")}>
      <form ref={form} onSubmit={(event) => void submit(event)} className="catalog-form">
        <Field label={t("upload.file")}>
          <TextInput type="file" accept={UPLOAD_ACCEPT} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </Field>
        <Field label={t("upload.label")} hint={t("upload.labelHint")}>
          <TextInput value={label} maxLength={MAX_VERSION_LABEL_CHARS} onChange={(event) => setLabel(event.target.value)} />
        </Field>
        <Field label={t("upload.effective")}>
          <TextInput type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
        </Field>
        <Button type="submit" variant="primary" disabled={busy || !file || !label.trim() || !effectiveFrom}>
          {busy ? t("upload.uploading") : t("upload.submit")}
        </Button>
      </form>
    </Disclosure>
  );
}
