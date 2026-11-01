import { TONE } from "../../../constants/tone";
import { useI18n } from "../../../i18n/useI18n";
import { Alert } from "../../../ui/Alert";
import { ListBlock } from "../../../ui/ListBlock";

export function CaveatList({ caveats }: { caveats: readonly string[] }) {
  const { t } = useI18n();
  if (caveats.length === 0) return null;
  return (
    <Alert tone={TONE.WARNING} role="note" className="assessment__block">
      <ListBlock title={t("caveats.title")} items={caveats} className="assessment__flush" />
    </Alert>
  );
}
