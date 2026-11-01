import type { Verdict } from "../../../api/types";
import { VERDICT_GLYPH } from "../../../constants/glyphs";
import { VERDICT_LABEL } from "../../../constants/labels";
import { VERDICT_TONE } from "../../../constants/tones";
import { useI18n } from "../../../i18n/useI18n";
import { cx } from "../../../lib/cx";
import { TONE_CLASS } from "../../../ui/tone";

interface Props {
  verdict: Verdict;
  headline: string;
  headingId: string;
}

/** The verdict is shown as an icon, a word and a colour: never by colour alone. */
export function VerdictBanner({ verdict, headline, headingId }: Props) {
  const { t } = useI18n();
  return (
    <header className={cx("verdict", TONE_CLASS[VERDICT_TONE[verdict]])}>
      <span className="verdict__icon" aria-hidden="true">
        {VERDICT_GLYPH[verdict]}
      </span>
      <div>
        <p className="verdict__label">{t(VERDICT_LABEL[verdict])}</p>
        <h3 id={headingId} className="verdict__headline">
          {headline}
        </h3>
      </div>
    </header>
  );
}
