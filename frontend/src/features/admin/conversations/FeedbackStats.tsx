import { EM_DASH } from "../../../constants/glyphs";
import { useResource } from "../../../hooks/useResource";
import { useI18n } from "../../../i18n/useI18n";
import { AsyncView } from "../../../shared/AsyncView";
import { Stat, StatGrid } from "../../../ui/Stat";
import { useAdminApi } from "../adminContext";

/** How many answers were rated, and how many of those were liked. */
export function FeedbackStats() {
  const { t, format } = useI18n();
  const api = useAdminApi();
  const { state, reload } = useResource(api.conversationStats, [api]);

  return (
    <AsyncView state={state} onRetry={reload}>
      {(stats) => (
        <StatGrid>
          <Stat label={t("conv.stat.conversations")} value={format.number(stats.conversations)} />
          <Stat label={t("conv.stat.rated")} value={format.number(stats.rated)} />
          <Stat label={t("conv.stat.up")} value={format.number(stats.up)} />
          <Stat label={t("conv.stat.down")} value={format.number(stats.down)} />
          <Stat
            label={t("conv.stat.satisfaction")}
            value={stats.satisfaction === null ? EM_DASH : format.percent(stats.satisfaction)}
            hint={
              stats.satisfaction === null
                ? t("conv.stat.noneRated")
                : t("conv.stat.satisfactionHint", { up: format.number(stats.up), rated: format.number(stats.rated) })
            }
          />
          <Stat label={t("conv.stat.commented")} value={format.number(stats.commented)} />
        </StatGrid>
      )}
    </AsyncView>
  );
}
