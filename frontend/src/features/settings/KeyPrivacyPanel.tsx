import type { MessageKey } from "../../i18n/messages";
import { useI18n } from "../../i18n/useI18n";
import { Card } from "../../ui/Card";

const PRIVACY_POINTS: readonly MessageKey[] = [
  "privacy.sent",
  "privacy.memory",
  "privacy.forgotten",
  "privacy.useOnly",
  "privacy.billing",
  "privacy.rotate",
];

/** Plain-language promise about the API key. Keep it in step with what the server really does. */
export function KeyPrivacyPanel() {
  const { t } = useI18n();
  return (
    <Card title={t("privacy.title")}>
      <ul>
        {PRIVACY_POINTS.map((point) => (
          <li key={point}>{t(point)}</li>
        ))}
      </ul>
    </Card>
  );
}
