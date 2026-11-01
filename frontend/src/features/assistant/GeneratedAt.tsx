import { useI18n } from "../../i18n/useI18n";

/** When an answer was produced, in the viewer's own time zone; the machine-readable time is kept in the markup. */
export function GeneratedAt({ iso }: { iso: string }) {
  const { t, format } = useI18n();
  return <time dateTime={iso}>{t("meta.generated", { when: format.dateTime(iso) })}</time>;
}
