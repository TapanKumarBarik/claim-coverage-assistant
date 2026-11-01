import type { Tone } from "../constants/tone";
import type { MessageKey } from "../i18n/messages";
import { useI18n } from "../i18n/useI18n";
import { Pill } from "../ui/Pill";

interface Props<T extends string> {
  value: T;
  tones: Readonly<Record<T, Tone>>;
  labels: Readonly<Record<T, MessageKey>>;
  /** Longer explanation shown as a tooltip. */
  title?: string;
}

/** A pill for a contract enum value: the label and tone both come from the typed maps in `constants/`. */
export function EnumPill<T extends string>({ value, tones, labels, title }: Props<T>) {
  const { t } = useI18n();
  return (
    <Pill tone={tones[value]} title={title}>
      {t(labels[value])}
    </Pill>
  );
}
