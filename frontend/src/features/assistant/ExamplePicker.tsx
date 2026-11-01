import type { Example } from "../../api/types";
import { useI18n } from "../../i18n/useI18n";
import { localized } from "../../lib/localized";
import { Button } from "../../ui/Button";

interface Props {
  examples: readonly Example[];
  onPick: (example: Example) => void;
}

/** One-click example claims. Picking one fills the message box; nothing is sent until the user decides. */
export function ExamplePicker({ examples, onPick }: Props) {
  const { lang } = useI18n();
  if (examples.length === 0) return null;
  return (
    <div className="example-picker">
      {examples.map((example) => (
        <Button key={example.id} variant="chip" onClick={() => onPick(example)}>
          {localized(example.title, lang)}
        </Button>
      ))}
    </div>
  );
}
