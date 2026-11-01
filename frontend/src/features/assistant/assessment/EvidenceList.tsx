import type { EvidenceItem } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { EmptyState } from "../../../ui/EmptyState";
import { EvidenceCard } from "./EvidenceCard";

export function EvidenceList({ evidence }: { evidence: readonly EvidenceItem[] }) {
  const { t } = useI18n();
  return (
    <section className="assessment__block">
      <h3>{t("evidence.title")}</h3>
      {evidence.length === 0 ? (
        <EmptyState>{t("evidence.none")}</EmptyState>
      ) : (
        <ul className="evidence-list">
          {evidence.map((item) => (
            <EvidenceCard key={`${item.ref}-${item.quote}`} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
