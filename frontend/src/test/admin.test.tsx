import { screen, waitFor, within } from "@testing-library/react";
import { API_PATH, versionActivatePath, documentVersionsPath } from "../api/paths";
import { ROUTE } from "../app/routes";
import { ERROR_CODE } from "../constants/domain";
import { HTTP_METHOD } from "../constants/http";
import { ADMIN_PASSWORD, adminSession, asAdmin, mockAdminApi } from "./adminHarness";
import { catalog, DOCUMENT_ID } from "./fixtures";
import { callsTo, errorResponse, jsonResponse, renderApp, routeKey } from "./harness";

async function signIn(user: ReturnType<typeof renderApp>, password = ADMIN_PASSWORD) {
  await user.type(await screen.findByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

const signedInSession = () => adminSession.signIn(); // the browser already holds a valid cookie
const draftV2 = catalog.contracts[0]!.documents[0]!.versions[1]!;

describe("Admin sign-in", () => {
  it("shows only the sign-in page until the password is accepted", async () => {
    mockAdminApi();
    renderApp({ route: ROUTE.ADMIN });

    expect(await screen.findByRole("heading", { name: "Administrator sign-in" })).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Administration" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the assistant" })).toHaveAttribute("href", "#/");
  });

  it("rejects a wrong password and accepts the right one, sending it once and keeping it nowhere", async () => {
    const fetchMock = mockAdminApi();
    const user = renderApp({ route: ROUTE.ADMIN });

    await signIn(user, "wrong");
    expect(await screen.findByRole("alert")).toHaveTextContent("That password was not accepted.");

    await user.clear(screen.getByLabelText("Password"));
    await signIn(user);
    expect(await screen.findByRole("region", { name: /Habitat Confort/ })).toBeInTheDocument();

    expect(callsTo(fetchMock, HTTP_METHOD.POST, API_PATH.adminSession).map((call) => call.body)).toEqual([
      { password: "wrong" },
      { password: ADMIN_PASSWORD },
    ]);
    expect(sessionStorage.length + localStorage.length).toBe(0); // nothing secret is left in the browser
    expect(JSON.stringify(fetchMock.mock.calls.map((args) => (args[1] as RequestInit | undefined)?.headers))).not.toContain(
      ADMIN_PASSWORD,
    ); // later calls ride on the cookie, not on a header
  });

  it("goes straight to the admin area when the server still recognises the session cookie", async () => {
    mockAdminApi();
    signedInSession();
    renderApp({ route: ROUTE.ADMIN });
    expect(await screen.findByRole("region", { name: /Habitat Confort/ })).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("shows the global token budget from the governance summary in the header", async () => {
    mockAdminApi();
    signedInSession();
    renderApp({ route: ROUTE.ADMIN });
    expect(await screen.findByText("Global token budget: 200,000 of 1,000,000")).toBeInTheDocument();
  });

  it.each([
    [ERROR_CODE.NOT_CONFIGURED, 503, "not enabled on this deployment"],
    [ERROR_CODE.RATE_LIMITED, 429, "Too many attempts"],
    [ERROR_CODE.LOCKED_OUT, 429, "Too many attempts"],
    [ERROR_CODE.UNAVAILABLE, 503, "busy or not available"],
  ] as const)("explains a %s answer at sign-in", async (code, status, text) => {
    mockAdminApi({ [routeKey(HTTP_METHOD.POST, API_PATH.adminSession)]: () => errorResponse(code, status) });
    const user = renderApp({ route: ROUTE.ADMIN });
    await signIn(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
  });

  it("brings the sign-in page back when the server ends the session", async () => {
    mockAdminApi();
    signedInSession();
    const user = renderApp({ route: ROUTE.ADMIN });
    await screen.findByRole("region", { name: /Habitat Confort/ });

    adminSession.expire(); // idle too long, or the server restarted
    await user.click(screen.getByRole("tab", { name: "Audit log" }));

    expect(await screen.findByRole("heading", { name: "Administrator sign-in" })).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("signs out on request, on the server as well as on the page", async () => {
    const fetchMock = mockAdminApi();
    signedInSession();
    const user = renderApp({ route: ROUTE.ADMIN });
    await user.click(await screen.findByRole("button", { name: "Sign out" }));

    expect(await screen.findByLabelText("Password")).toBeInTheDocument();
    expect(callsTo(fetchMock, HTTP_METHOD.DELETE, API_PATH.adminSession)).toHaveLength(1);
    expect(adminSession.signedIn).toBe(false);
  });
});

describe("Admin tabs", () => {
  it("offers the catalogue, conversations, AI governance and the audit log", async () => {
    mockAdminApi();
    signedInSession();
    const user = renderApp({ route: ROUTE.ADMIN });

    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Contracts and documents", "Conversations", "AI governance", "Audit log"]);
    expect(screen.getByRole("tab", { name: "Contracts and documents" })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("tab", { name: "Audit log" }));
    const table = await screen.findByRole("table", { name: "Catalogue changes" });
    expect(within(table).getByText("version.activate")).toBeInTheDocument();
    expect(within(table).getByText(/version_id: demo-habitat-confort-cg@1/)).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
  });

  it("says so when the audit log is empty", async () => {
    mockAdminApi({ [routeKey(HTTP_METHOD.GET, API_PATH.adminAudit)]: asAdmin(() => jsonResponse([])) });
    signedInSession();
    const user = renderApp({ route: ROUTE.ADMIN });
    await user.click(await screen.findByRole("tab", { name: "Audit log" }));
    expect(await screen.findByText("No events recorded yet.")).toBeInTheDocument();
  });

  it("shows an error with a retry button when a tab cannot load", async () => {
    mockAdminApi({ [routeKey(HTTP_METHOD.GET, API_PATH.adminAudit)]: asAdmin(() => errorResponse(ERROR_CODE.UNAVAILABLE, 503)) });
    signedInSession();
    const user = renderApp({ route: ROUTE.ADMIN });
    await user.click(await screen.findByRole("tab", { name: "Audit log" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("busy or not available");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("Admin catalogue", () => {
  it("shows the draft's status and activates it only after confirmation", async () => {
    const fetchMock = mockAdminApi({
      [routeKey(HTTP_METHOD.POST, versionActivatePath(draftV2.id))]: asAdmin(() => jsonResponse({ ...draftV2, status: "live" })),
    });
    signedInSession();
    const user = renderApp({ route: ROUTE.ADMIN });

    expect(await screen.findByText("Draft")).toBeInTheDocument();
    expect(screen.getAllByText("Live").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Activate v2" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/Claims with a loss date on or after .*2026.* will be assessed against this wording/);
    // Nothing is sent until the admin confirms.
    expect(callsTo(fetchMock, HTTP_METHOD.POST, versionActivatePath(draftV2.id))).toHaveLength(0);

    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(callsTo(fetchMock, HTTP_METHOD.POST, versionActivatePath(draftV2.id))).toHaveLength(1));
  });

  it("closes the confirmation without sending anything when cancelled", async () => {
    const fetchMock = mockAdminApi();
    signedInSession();
    const user = renderApp({ route: ROUTE.ADMIN });
    await user.click(await screen.findByRole("button", { name: "Delete v2" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === HTTP_METHOD.DELETE)).toBe(false);
  });

  it("uploads a new version as a draft and shows what changed against the live one", async () => {
    const draft = {
      ...draftV2,
      id: `${DOCUMENT_ID}@3`,
      label: "v3",
      parse_warnings: ["Some very short chunks were produced; check the layout."],
    };
    const fetchMock = mockAdminApi({
      [routeKey(HTTP_METHOD.POST, documentVersionsPath(DOCUMENT_ID))]: asAdmin(() => jsonResponse(draft, 201)),
    });
    signedInSession();
    const user = renderApp({ route: ROUTE.ADMIN });

    await user.click((await screen.findAllByText("Upload a new version"))[0]!);
    const file = new File(["# Article 1\ntext"], "cg_v3.md", { type: "text/markdown" });
    await user.upload(screen.getByLabelText(/File \(PDF/), file);
    await user.type(screen.getByLabelText(/Version label/), "v3");
    await user.click(screen.getByRole("button", { name: "Upload as draft" }));

    expect(await screen.findByText(/Draft v3 created/)).toBeInTheDocument();
    expect(screen.getByText("Some very short chunks were produced; check the layout.")).toBeInTheDocument();
    expect(screen.getAllByText("Article 9 - Vol dans les locaux communs").length).toBeGreaterThan(0);

    const [call] = callsTo(fetchMock, HTTP_METHOD.POST, documentVersionsPath(DOCUMENT_ID));
    const form = call?.body as FormData;
    expect(form.get("label")).toBe("v3");
    expect((form.get("file") as File).name).toBe("cg_v3.md");
    expect(form.get("effective_from")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("creates a contract with the defaults the form does not ask for", async () => {
    const fetchMock = mockAdminApi({
      [routeKey(HTTP_METHOD.POST, API_PATH.adminContracts)]: asAdmin(() => jsonResponse(catalog.contracts[0], 201)),
    });
    signedInSession();
    const user = renderApp({ route: ROUTE.ADMIN });

    const summary = await screen.findByText("Add a contract");
    await user.click(summary);
    const form = within(summary.closest("details") as HTMLElement);
    await user.type(form.getByLabelText("Identifier"), "new-contract");
    await user.type(form.getByLabelText("Insurer"), "Acme");
    await user.type(form.getByLabelText("Product"), "Home");
    await user.click(form.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(callsTo(fetchMock, HTTP_METHOD.POST, API_PATH.adminContracts)).toHaveLength(1));
    expect(callsTo(fetchMock, HTTP_METHOD.POST, API_PATH.adminContracts)[0]?.body).toEqual({
      id: "new-contract",
      insurer: "Acme",
      product: "Home",
      country: "LU",
      language: "fr",
    });
  });

  it("shows a failed change as a localized error and keeps the screen usable", async () => {
    mockAdminApi({
      [routeKey(HTTP_METHOD.POST, versionActivatePath(draftV2.id))]: asAdmin(() => errorResponse(ERROR_CODE.CONFLICT, 409)),
    });
    signedInSession();
    const user = renderApp({ route: ROUTE.ADMIN });
    await user.click(await screen.findByRole("button", { name: "Activate v2" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Confirm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("conflicts with the current state");
    expect(screen.getByRole("region", { name: /Habitat Confort/ })).toBeInTheDocument();
  });
});

