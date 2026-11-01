import type { Rating } from "../../../api/types";
import { RATING_LABEL } from "../../../constants/labels";
import { RATING_TONE } from "../../../constants/tones";
import { RATING } from "../../../constants/domain";
import { useI18n } from "../../../i18n/useI18n";
import { CommentIcon, ThumbDownIcon, ThumbUpIcon } from "../../../ui/icons";
import { Pill } from "../../../ui/Pill";

interface Props {
  rating: Rating | null;
  hasComment: boolean;
}

/** Liked, disliked or not rated, with a speech-bubble when the visitor also wrote something. */
export function RatingPill({ rating, hasComment }: Props) {
  const { t } = useI18n();
  if (rating === null) return <span className="muted">{t("conv.unrated")}</span>;
  const Icon = rating === RATING.UP ? ThumbUpIcon : ThumbDownIcon;
  return (
    <span className="rating-pill">
      <Pill tone={RATING_TONE[rating]}>
        <Icon width={13} height={13} /> {t(RATING_LABEL[rating])}
      </Pill>
      {hasComment && (
        <span className="rating-pill__comment" title={t("conv.stat.commented")} role="img" aria-label={t("conv.stat.commented")}>
          <CommentIcon width={14} height={14} />
        </span>
      )}
    </span>
  );
}
