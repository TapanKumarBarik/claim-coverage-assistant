import { useI18n } from "../../../i18n/useI18n";
import { Field } from "../../../ui/Field";
import { Select } from "../../../ui/Select";
import { WINDOW_OPTIONS } from "./windows";

interface Props {
  hours: number;
  onChange: (hours: number) => void;
}

export function WindowSelect({ hours, onChange }: Props) {
  const { t } = useI18n();
  return (
    <Field label={t("gov.window.label")} narrow>
      <Select value={hours} onChange={(event) => onChange(Number(event.target.value))}>
        {WINDOW_OPTIONS.map((option) => (
          <option key={option.hours} value={option.hours}>
            {t(option.label)}
          </option>
        ))}
      </Select>
    </Field>
  );
}
