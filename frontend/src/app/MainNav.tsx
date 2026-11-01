import { useI18n } from "../i18n/useI18n";
import { NAV_ITEMS, ROUTE_HASH, type Route } from "./routes";

export function MainNav({ current }: { current: Route }) {
  const { t } = useI18n();
  return (
    <nav aria-label={t("nav.label")} className="main-nav">
      {NAV_ITEMS.map(({ route, labelKey }) => (
        <a key={route} href={ROUTE_HASH[route]} aria-current={route === current ? "page" : undefined}>
          {t(labelKey)}
        </a>
      ))}
    </nav>
  );
}
