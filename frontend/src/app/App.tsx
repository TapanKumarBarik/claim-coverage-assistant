import { useRef, type ComponentType, type MouseEvent } from "react";
import { useI18n } from "../i18n/useI18n";
import { cx } from "../lib/cx";
import { AdminPage } from "../features/admin/AdminPage";
import { AssistantPage } from "../features/assistant/AssistantPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { Header } from "./Header";
import { ROUTE, type Route } from "./routes";
import { useRoute } from "./useRoute";
import "./app.css";

const PAGES: Record<Route, ComponentType> = {
  [ROUTE.ASSISTANT]: AssistantPage,
  [ROUTE.SETTINGS]: SettingsPage,
  [ROUTE.ADMIN]: AdminPage,
};

const MAIN_ID = "main";

export default function App() {
  const { t } = useI18n();
  const route = useRoute();
  const Page = PAGES[route];
  const main = useRef<HTMLElement>(null);

  // Move focus instead of following the link: a "#main" hash would be read as a route change.
  function skipToContent(event: MouseEvent) {
    event.preventDefault();
    main.current?.focus();
  }
  return (
    <>
      <a className="skip-link" href={`#${MAIN_ID}`} onClick={skipToContent}>
        {t("app.skip")}
      </a>
      <Header route={route} />
      <main id={MAIN_ID} ref={main} tabIndex={-1} className={cx("container", route === ROUTE.ASSISTANT && "container--chat")}>
        <Page />
      </main>
    </>
  );
}
