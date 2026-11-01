import { screen } from "@testing-library/react";
import { messages } from "../i18n/messages";
import { ROUTE } from "../app/routes";
import { LANGUAGE } from "../constants/domain";
import { mockAdminApi } from "./adminHarness";
import { defaultRoutes, mockApi, renderApp } from "./harness";

describe("App shell", () => {
  it("has a skip link that moves focus to the content without changing the page", async () => {
    mockAdminApi();
    const user = renderApp({ route: ROUTE.ADMIN });
    await screen.findByLabelText("Password");

    await user.click(screen.getByRole("link", { name: "Skip to content" }));

    expect(screen.getByRole("main")).toHaveFocus();
    expect(screen.getByLabelText("Password")).toBeInTheDocument(); // still on the admin page
    expect(window.location.hash).toBe("#/admin");
  });

  it("marks the current page in the navigation", async () => {
    mockApi(defaultRoutes());
    renderApp({ route: ROUTE.SETTINGS });
    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(nav.querySelector("[aria-current='page']")).toHaveTextContent("Settings");
  });

  it("follows the URL hash between pages", async () => {
    mockApi(defaultRoutes());
    const user = renderApp();
    await screen.findByRole("heading", { name: "Is your claim covered?" });

    await user.click(screen.getByRole("link", { name: "Settings" }));
    expect(await screen.findByRole("heading", { name: "Your Azure OpenAI connection" })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Admin" }));
    expect(await screen.findByRole("heading", { name: "Administrator sign-in" })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Assistant" }));
    expect(await screen.findByRole("heading", { name: "Is your claim covered?" })).toBeInTheDocument();
  });
});

describe("translations", () => {
  const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  const keys = Object.keys(messages[LANGUAGE.EN]) as Array<keyof (typeof messages)["en"]>;

  it("has no empty string in either language", () => {
    for (const lang of Object.values(LANGUAGE)) {
      for (const key of keys) expect(messages[lang][key].trim(), `${lang}:${key}`).not.toBe("");
    }
  });

  it("uses the same {placeholders} in French as in English for every message", () => {
    for (const key of keys) {
      expect(placeholders(messages.fr[key]), key).toEqual(placeholders(messages.en[key]));
    }
  });
});
