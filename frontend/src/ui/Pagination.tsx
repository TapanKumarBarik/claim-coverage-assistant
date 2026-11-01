import { useI18n } from "../i18n/useI18n";
import { Button } from "./Button";
import "./Pagination.css";

interface Props {
  total: number;
  offset: number;
  limit: number;
  onChange: (offset: number) => void;
}

/** "26–50 of 63" with Previous and Next. Renders nothing when there is nothing to page through. */
export function Pagination({ total, offset, limit, onChange }: Props) {
  const { t, format } = useI18n();
  if (total === 0) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <nav className="pagination" aria-label={t("page.label")}>
      <span className="muted small">{t("page.range", { from: format.number(from), to: format.number(to), total: format.number(total) })}</span>
      <Button small disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
        {t("page.previous")}
      </Button>
      <Button small disabled={to >= total} onClick={() => onChange(offset + limit)}>
        {t("page.next")}
      </Button>
    </nav>
  );
}
