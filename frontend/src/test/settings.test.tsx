import { screen, waitFor, within } from "@testing-library/react";
import { API_PATH } from "../api/paths";
import type { ErrorCode } from "../api/types";
import { ERROR_CODE } from "../constants/domain";
import { HTTP_METHOD } from "../constants/http";
import { ROUTE } from "../app/routes";
import { noSession, noSessionAndNoByo, ownKeySession, serverSession } from "./fixtures";
import { callsTo, defaultRoutes, errorResponse, jsonResponse, mockApi, renderApp, routeKey, type Routes } from "./harness";

const SESSION = routeKey(HTTP_METHOD.GET, API_PATH.session);
const SAVE = routeKey(HTTP_METHOD.PUT, API_PATH.sessionCredentials);
const FORGET = routeKey(HTTP_METHOD.DELETE, API_PATH.sessionCredentials);

const SECRET_KEY = "sk-test-0123456789abcdef";
const ENDPOINT = "https://my-resource.openai.azure.com";

function settingsApi(routes: Routes = {}, session = noSession) {
  return mockApi({ ...defaultRoutes(session), ...routes });
}

async function fillForm(
  user: ReturnType<typeof renderApp>,
  { fast = "", apiVersion = "", endpoint = ENDPOINT, key = SECRET_KEY, reasoning = "gpt-5" } = {},
) {
  await user.type(await screen.findByLabelText("Endpoint"), endpoint);
  await user.type(screen.getByLabelText("API key"), key);
  await user.type(screen.getByLabelText("Reasoning model deployment name"), reasoning);
  if (fast) await user.type(screen.getByLabelText(/Small model deployment name/), fast);
  if (apiVersion) {
    await user.click(screen.getByText("Advanced"));
    await user.type(screen.getByLabelText(/API version/), apiVersion);
  }
}

const submit = (user: ReturnType<typeof renderApp>) => user.click(screen.getByRole("button", { name: "Save and test connection" }));

describe("Settings: connect your own Azure OpenAI resource", () => {
  it("has the fields the brief asks for, and keeps the key out of autofill and spellcheck", async () => {
    settingsApi();
    renderApp({ route: ROUTE.SETTINGS });

    const endpoint = await screen.findByLabelText("Endpoint");
    expect(endpoint).toHaveAttribute("placeholder", "https://<resource>.openai.azure.com");
    const key = screen.getByLabelText("API key");
    expect(key).toHaveAttribute("type", "password");
    expect(key).toHaveAttribute("autocomplete", "off");
    expect(key).toHaveAttribute("spellcheck", "false");
    expect(screen.getByText(/If empty, the reasoning deployment is used/)).toBeInTheDocument();
    expect(screen.getByText("Advanced")).toBeInTheDocument();
  });

  it("clears the key as soon as it is submitted, and shows the connection that was accepted", async () => {
    let finish: (response: Response) => void = () => undefined;
    // Hold the response back so we can look at the page while the request is in flight.
    const held = new Promise<Response>((resolve) => (finish = resolve));
    settingsApi({ [SAVE]: () => held });

    const user = renderApp({ route: ROUTE.SETTINGS });
    await fillForm(user, { fast: "gpt-5-mini" });
    await submit(user);

    // In flight: busy state, and the key is already gone from the page.
    expect(await screen.findByRole("button", { name: "Testing connection…" })).toBeDisabled();
    expect(screen.getByLabelText("API key")).toHaveValue("");
    expect(document.body.innerHTML).not.toContain(SECRET_KEY);

    finish(jsonResponse(ownKeySession(30)));

    const status = await screen.findByRole("region", { name: "Current connection" });
    expect(within(status).getByText("my-resource.openai.azure.com")).toBeInTheDocument();
    expect(within(status).getByText("gpt-5")).toBeInTheDocument();
    expect(within(status).getByText("gpt-5-mini")).toBeInTheDocument();
    expect(within(status).getByText("Your own key")).toBeInTheDocument();
    expect(within(status).getByText("Forgotten after 30 minutes of inactivity.")).toBeInTheDocument();
    expect(screen.getByText(/Connected. Your settings were tested/)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Connected: my-resource.openai.azure.com" })).toBeInTheDocument();

    // The whole form is reset and the key is nowhere in the document.
    expect(screen.getByLabelText("API key")).toHaveValue("");
    expect(screen.getByLabelText("Endpoint")).toHaveValue("");
    expect(document.body.innerHTML).not.toContain(SECRET_KEY);
  });

  it("puts exactly the contract's fields in the PUT body, and nothing else anywhere", async () => {
    const fetchMock = settingsApi({ [SAVE]: () => jsonResponse(ownKeySession()) });
    const user = renderApp({ route: ROUTE.SETTINGS });
    await fillForm(user, { fast: "gpt-5-mini", apiVersion: "2025-04-01-preview" });
    await submit(user);
    await screen.findByText(/Connected\. Your settings were tested/);

    const saves = callsTo(fetchMock, HTTP_METHOD.PUT, API_PATH.sessionCredentials);
    expect(saves).toHaveLength(1);
    expect(saves[0]?.body).toEqual({
      endpoint: ENDPOINT,
      api_key: SECRET_KEY,
      reasoning_deployment: "gpt-5",
      fast_deployment: "gpt-5-mini",
      api_version: "2025-04-01-preview",
    });
    // The key is in no other request: not in a URL, not in a header, not in another body.
    const everythingElse = fetchMock.mock.calls.filter(([, init]) => init?.method !== HTTP_METHOD.PUT);
    expect(JSON.stringify(everythingElse)).not.toContain(SECRET_KEY);
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });

  it("leaves out the optional fields when they are blank", async () => {
    const fetchMock = settingsApi({ [SAVE]: () => jsonResponse(ownKeySession()) });
    const user = renderApp({ route: ROUTE.SETTINGS });
    await fillForm(user);
    await submit(user);
    await screen.findByText(/Connected\. Your settings were tested/);

    expect(callsTo(fetchMock, HTTP_METHOD.PUT, API_PATH.sessionCredentials)[0]?.body).toEqual({
      endpoint: ENDPOINT,
      api_key: SECRET_KEY,
      reasoning_deployment: "gpt-5",
    });
  });

  it("gives quick hints for an obviously wrong form without calling the server", async () => {
    const fetchMock = settingsApi();
    const user = renderApp({ route: ROUTE.SETTINGS });
    await fillForm(user, { endpoint: "http://example.com", key: "short", reasoning: "bad name!" });
    await submit(user);

    expect(await screen.findByText(/Enter an https address ending in \.openai\.azure\.com/)).toBeInTheDocument();
    expect(screen.getByText(/Enter your API key \(8 characters or more\)/)).toBeInTheDocument();
    expect(screen.getByText(/Use letters, digits, dots, dashes and underscores only/)).toBeInTheDocument();
    expect(screen.getByLabelText("Endpoint")).toHaveAttribute("aria-invalid", "true");
    expect(callsTo(fetchMock, HTTP_METHOD.PUT, API_PATH.sessionCredentials)).toHaveLength(0);
  });

  it.each([
    ["en", "Azure OpenAI did not accept these settings"],
    ["fr", "Azure OpenAI n'a pas accepté ces paramètres"],
  ] as const)("explains rejected credentials (%s) and still clears the key", async (language, message) => {
    settingsApi({ [SAVE]: () => errorResponse(ERROR_CODE.CREDENTIALS_REJECTED, 422, { detail: "401 from upstream: invalid subscription key" }) });
    const user = renderApp({ route: ROUTE.SETTINGS, language });
    const labels = language === "en" ? ["Endpoint", "API key", "Reasoning model deployment name"] : ["Adresse (endpoint)", "Clé d'API", "Nom du déploiement du modèle de raisonnement"];
    await user.type(await screen.findByLabelText(labels[0]!), ENDPOINT);
    await user.type(screen.getByLabelText(labels[1]!), SECRET_KEY);
    await user.type(screen.getByLabelText(labels[2]!), "gpt-5");
    await user.click(screen.getByRole("button", { name: language === "en" ? "Save and test connection" : "Enregistrer et tester la connexion" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(message);
    expect(alert).not.toHaveTextContent("invalid subscription key"); // server text is not echoed
    expect(screen.getByLabelText(labels[1]!)).toHaveValue("");
    expect(document.body.innerHTML).not.toContain(SECRET_KEY);
    // What the user typed that is not secret stays, so only the key needs retyping.
    expect(screen.getByLabelText(labels[0]!)).toHaveValue(ENDPOINT);
  });

  it.each<[ErrorCode, number, string]>([
    [ERROR_CODE.INVALID_INPUT, 422, "Please check what you entered"],
    [ERROR_CODE.UNAVAILABLE, 503, "busy or not available"],
    [ERROR_CODE.FORBIDDEN, 403, "not allowed on this server"],
    [ERROR_CODE.RATE_LIMITED, 429, "Too many requests"],
    [ERROR_CODE.UPSTREAM_ERROR, 502, "did not answer properly"],
  ])("maps %s to a plain message", async (code, status, text) => {
    settingsApi({ [SAVE]: () => errorResponse(code, status, { detail: "" }) });
    const user = renderApp({ route: ROUTE.SETTINGS });
    await fillForm(user);
    await submit(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
  });

  it("forgets the credentials on request and goes back to 'not connected'", async () => {
    let connected = true;
    const fetchMock = settingsApi(
      {
        [SESSION]: () => jsonResponse(connected ? ownKeySession() : noSession),
        [FORGET]: () => {
          connected = false;
          return jsonResponse(null, 204);
        },
      },
      ownKeySession(),
    );
    const user = renderApp({ route: ROUTE.SETTINGS });

    expect(await screen.findByRole("link", { name: "Connected: my-resource.openai.azure.com" })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Forget my credentials" }));

    expect(await screen.findByText("Your credentials were forgotten.")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Not connected" })).toBeInTheDocument();
    expect(screen.getByText("Not connected yet. Add your settings below.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Forget my credentials" })).not.toBeInTheDocument();
    expect(callsTo(fetchMock, HTTP_METHOD.DELETE, API_PATH.sessionCredentials)).toHaveLength(1);
  });

  it("reports a failed 'forget' instead of pretending it worked", async () => {
    settingsApi({ [FORGET]: () => errorResponse(ERROR_CODE.UNAVAILABLE, 503) }, ownKeySession());
    const user = renderApp({ route: ROUTE.SETTINGS });
    await user.click(await screen.findByRole("button", { name: "Forget my credentials" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("busy or not available");
    expect(screen.queryByText("Your credentials were forgotten.")).not.toBeInTheDocument();
  });

  it("describes server-managed credentials without offering to forget them", async () => {
    settingsApi({}, serverSession);
    renderApp({ route: ROUTE.SETTINGS });
    const status = await screen.findByRole("region", { name: "Current connection" });
    expect(within(status).getByText("These credentials are managed by the server.")).toBeInTheDocument();
    expect(within(status).queryByRole("button")).not.toBeInTheDocument();
  });

  it("hides the form when the server does not accept personal credentials", async () => {
    settingsApi({}, noSessionAndNoByo);
    renderApp({ route: ROUTE.SETTINGS });
    expect(await screen.findByText("This server does not accept personal credentials.")).toBeInTheDocument();
    expect(screen.queryByLabelText("API key")).not.toBeInTheDocument();
  });

  it("explains in plain words what happens to the key, in both languages", async () => {
    settingsApi();
    renderApp({ route: ROUTE.SETTINGS });
    const panel = await screen.findByRole("region", { name: "What happens to my key?" });
    for (const point of [/sent once, over HTTPS/, /server's memory/, /never written to disk or to logs/, /forgotten when you have been idle/, /your own Azure OpenAI resource/, /pay for your own usage/, /rotate or revoke/]) {
      expect(within(panel).getByText(point)).toBeInTheDocument();
    }
    await waitFor(() => expect(screen.getByLabelText("API key")).toBeInTheDocument());
  });

  it("is available in French", async () => {
    settingsApi();
    renderApp({ route: ROUTE.SETTINGS, language: "fr" });
    expect(await screen.findByRole("region", { name: "Que devient ma clé ?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enregistrer et tester la connexion" })).toBeInTheDocument();
    expect(screen.getByLabelText("Clé d'API")).toHaveAttribute("type", "password");
  });
});
