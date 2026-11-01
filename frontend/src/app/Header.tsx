import { useI18n } from "../i18n/useI18n";
import { ConnectionPill } from "../features/session/ConnectionPill";
import { BrandMark } from "../ui/BrandMark";
import { LanguageSwitch } from "./LanguageSwitch";
import { MainNav } from "./MainNav";
import { ROUTE, type Route } from "./routes";
import "./app.css";

export function Header({ route }: { route: Route }) {
  const { t } = useI18n();
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="brand">
          <BrandMark />
          <h1>{t("app.title")}</h1>
        </div>
        <div className="site-header__controls">
          <MainNav current={route} />
          <ConnectionPill current={route === ROUTE.SETTINGS} />
          <LanguageSwitch />
        </div>
      </div>
    </header>
  );
}
