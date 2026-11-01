import type { GuardPolicy } from "../../../../api/types";
import { GUARD_STAGES } from "../../../../constants/domain";
import { GUARD_NAME_LABEL, GUARD_STAGE_LABEL } from "../../../../constants/labels";
import { useI18n } from "../../../../i18n/useI18n";
import "../governance.css";

/** Guardrails grouped by the stage they run in. Descriptions are written by the server and are not translated. */
export function GuardList({ guards }: { guards: readonly GuardPolicy[] }) {
  const { t } = useI18n();
  return (
    <>
      {GUARD_STAGES.map((stage) => {
        const inStage = guards.filter((guard) => guard.stage === stage);
        if (inStage.length === 0) return null;
        return (
          <div key={stage}>
            <p className="label">{t(GUARD_STAGE_LABEL[stage])}</p>
            <ul className="policy-list">
              {inStage.map((guard) => (
                <li key={guard.name}>
                  <strong>{t(GUARD_NAME_LABEL[guard.name])}</strong>
                  <span>{guard.description}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}
