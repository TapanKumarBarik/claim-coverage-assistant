import type { DocumentVersion } from "../../../api/types";
import { EM_DASH } from "../../../constants/glyphs";
import type { MessageKey } from "../../../i18n/messages";
import { useI18n } from "../../../i18n/useI18n";
import { ListBlock } from "../../../ui/ListBlock";

/** What a freshly uploaded draft changed compared with the version before it. */
export function ChangeSummary({ version }: { version: DocumentVersion }) {
  const { t } = useI18n();
  const summary = version.change_summary;
  if (!summary) return <p className="muted">{t("upload.firstVersion")}</p>;

  const groups: ReadonlyArray<[MessageKey, string[]]> = [
    ["upload.added", summary.added],
    ["upload.removed", summary.removed],
    ["upload.modified", summary.modified],
  ];
  return (
    <div>
      <p className="label">{t("upload.changes", { previous: summary.compared_to ?? EM_DASH })}</p>
      {groups.map(([title, items]) => (
        <ListBlock key={title} title={t(title)} items={items} compact />
      ))}
      <p className="muted">{t("upload.unchanged", { n: summary.unchanged })}</p>
    </div>
  );
}
