import type { SecretsPosture as Posture } from "../../../../api/types";
import { OPENAI_AUTH } from "../../../../constants/domain";
import { OPENAI_AUTH_LABEL } from "../../../../constants/labels";
import { TONE, type Tone } from "../../../../constants/tone";
import type { MessageKey } from "../../../../i18n/messages";
import { useI18n } from "../../../../i18n/useI18n";
import { DescriptionList } from "../../../../ui/DescriptionList";
import { Pill } from "../../../../ui/Pill";

const okOrWarn = (good: boolean): Tone => (good ? TONE.OK : TONE.WARNING);

/** Read-only checklist of how secrets and personal data are handled: green when good, amber when not. */
export function SecretsPosture({ secrets }: { secrets: Posture }) {
  const { t } = useI18n();
  const rows: Array<{ label: MessageKey; good: boolean; value: string }> = [
    {
      label: "gov.secrets.adminToken",
      good: secrets.admin_token_hashed,
      value: t(secrets.admin_token_hashed ? "gov.secrets.hashed" : "gov.secrets.notHashed"),
    },
    {
      label: "gov.secrets.openaiAuth",
      good: secrets.openai_auth === OPENAI_AUTH.MANAGED_IDENTITY,
      value: t(OPENAI_AUTH_LABEL[secrets.openai_auth]),
    },
    {
      label: "gov.secrets.logRedaction",
      good: secrets.log_redaction,
      value: t(secrets.log_redaction ? "gov.secrets.redacting" : "gov.secrets.notRedacting"),
    },
    {
      label: "gov.secrets.clientAddresses",
      good: secrets.client_addresses_pseudonymised,
      value: t(secrets.client_addresses_pseudonymised ? "gov.secrets.pseudonymised" : "gov.secrets.notPseudonymised"),
    },
  ];
  return (
    <DescriptionList
      items={rows.map((row) => ({ term: t(row.label), detail: <Pill tone={okOrWarn(row.good)}>{row.value}</Pill> }))}
    />
  );
}
