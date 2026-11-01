import type { Outcome } from "../../../api/types";
import { OUTCOMES } from "../../../constants/domain";
import { isOneOf } from "../../../constants/enumOf";
import { OUTCOME_LABEL } from "../../../constants/labels";
import { useI18n } from "../../../i18n/useI18n";
import { Field } from "../../../ui/Field";
import { Select } from "../../../ui/Select";

/** Filter value meaning "no outcome filter". */
export const ALL_OUTCOMES = "all";
export type OutcomeFilterValue = Outcome | typeof ALL_OUTCOMES;

interface Props {
  value: OutcomeFilterValue;
  onChange: (value: OutcomeFilterValue) => void;
}

export function OutcomeFilter({ value, onChange }: Props) {
  const { t } = useI18n();
  return (
    <Field label={t("gov.events.filter")} narrow>
      <Select value={value} onChange={(event) => onChange(isOneOf(OUTCOMES, event.target.value) ? event.target.value : ALL_OUTCOMES)}>
        <option value={ALL_OUTCOMES}>{t("gov.events.all")}</option>
        {OUTCOMES.map((outcome) => (
          <option key={outcome} value={outcome}>
            {t(OUTCOME_LABEL[outcome])}
          </option>
        ))}
      </Select>
    </Field>
  );
}
