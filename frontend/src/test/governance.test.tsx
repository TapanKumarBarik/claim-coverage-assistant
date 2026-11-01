import { screen, waitFor, within } from "@testing-library/react";
import { API_PATH, conversationPath } from "../api/paths";
import type { AiEvent, GovernanceSummary } from "../api/types";
import { ROUTE } from "../app/routes";
import { ERROR_CODE, OUTCOMES } from "../constants/domain";
import { HTTP_METHOD } from "../constants/http";
import { adminRoute, adminSession, mockAdminApi } from "./adminHarness";
import { BLOCKED_EXCERPT, conversationDetail, emptySummary, events, policy, summary } from "./fixtures";
import { callsTo, errorResponse, jsonResponse, renderApp } from "./harness";

type Options = Parameters<typeof renderApp>[0];

/** Signs in and opens the "AI governance" tab, which starts on its Overview. */
async function openGovernance(options: Options = {}) {
  adminSession.signIn();
  const user = renderApp({ route: ROUTE.ADMIN, ...options });
  await user.click(await screen.findByRole("tab", { name: options?.language === "fr" ? "Gouvernance de l'IA" : "AI governance" }));
  return user;
}

type User = Awaited<ReturnType<typeof openGovernance>>;

/** Opens one of the three parts under the tab. */
const openPart = (user: User, name: string) => user.click(screen.getByRole("tab", { name }));

/** The figure printed under a headline label. */
function kpi(label: string): HTMLElement {
  const term = screen.getByText(label, { selector: "dt" });
  return term.parentElement as HTMLElement;
}

/** The fixture's window with nothing wrong: no errors, nobody locked out. */
const healthy: GovernanceSummary = {
  ...summary,
  by_outcome: { ...summary.by_outcome, error: 0 },
  abuse: { ...summary.abuse, locked_out_clients_now: 0 },
};

const withSummary = (data: GovernanceSummary) => adminRoute(API_PATH.governanceSummary, () => jsonResponse(data));

describe("AI governance: the three parts", () => {
  it("offers Overview, Requests and Rules, and starts on the overview", async () => {
    mockAdminApi();
    await openGovernance();
    const tabs = within(await screen.findByRole("tablist", { name: "Governance sections" })).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Overview", "Requests", "Rules"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("loads each part only when it is opened", async () => {
    const fetchMock = mockAdminApi();
    const user = await openGovernance();
    await screen.findByText("Breakdowns");
    expect(callsTo(fetchMock, HTTP_METHOD.GET, API_PATH.governanceEvents)).toHaveLength(0);
    expect(callsTo(fetchMock, HTTP_METHOD.GET, API_PATH.governancePolicy)).toHaveLength(0);

    await openPart(user, "Requests");
    await screen.findByRole("table", { name: "Recent AI requests" });
    expect(callsTo(fetchMock, HTTP_METHOD.GET, API_PATH.governancePolicy)).toHaveLength(0);

    await openPart(user, "Rules");
    await screen.findByRole("table", { name: "Model tiers" });
    expect(callsTo(fetchMock, HTTP_METHOD.GET, API_PATH.governancePolicy)).toHaveLength(1);
  });
});

describe("AI governance: overview status", () => {
  it("says everything is normal when nothing needs attention", async () => {
    mockAdminApi(withSummary(healthy));
    await openGovernance();
    expect(await screen.findByText("All normal")).toBeInTheDocument();
    expect(screen.getByText("Requests in this period: 120. No errors, the model service is healthy and 20% of the token budget is used.")).toBeInTheDocument();
  });

  it("names what needs attention instead of leaving it to be found", async () => {
    mockAdminApi(); // the fixture has 2 errors and 1 locked-out client
    await openGovernance();
    expect(await screen.findByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("Requests that ended in an error: 2.")).toBeInTheDocument();
    expect(screen.getByText("Clients locked out right now: 1.")).toBeInTheDocument();
    expect(screen.queryByText(/All normal/)).not.toBeInTheDocument();
  });

  it.each([
    ["half_open", "Needs attention", "The model service is being tested after 5 failures in a row (circuit breaker half-open)."],
    ["open", "Action needed", "The model service is paused (circuit breaker open) after 5 failures in a row."],
  ] as const)("raises the circuit breaker when it is %s", async (state, headline, message) => {
    mockAdminApi(withSummary({ ...healthy, breaker: { state, consecutive_failures: 5 } }));
    await openGovernance();
    expect(await screen.findByText(headline)).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it.each([
    [850_000, "Needs attention", "85%"],
    [1_000_000, "Action needed", "100%"],
  ] as const)("warns when %s of the token budget is used", async (used, headline, percent) => {
    mockAdminApi(withSummary({ ...healthy, budgets: { ...healthy.budgets, global_used: used } }));
    await openGovernance();
    expect(await screen.findByText(headline)).toBeInTheDocument();
    expect(screen.getByText(`Share of the global token budget used: ${percent}.`)).toBeInTheDocument();
  });

  it("warns when too few quoted clauses could be verified", async () => {
    mockAdminApi(withSummary({ ...healthy, citations: { verified: 5, dropped: 5, verify_rate: 0.5 } }));
    await openGovernance();
    expect(await screen.findByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("Share of quoted clauses that could be verified: 50%.")).toBeInTheDocument();
  });

  it("does not judge a citation rate over no citations at all", async () => {
    mockAdminApi(withSummary({ ...emptySummary, abuse: { ...emptySummary.abuse, locked_out_clients_now: 0 } }));
    await openGovernance();
    expect(await screen.findByText("All normal")).toBeInTheDocument();
  });
});

describe("AI governance: overview figures", () => {
  it("shows requests, blocked, citations and slow-request latency, each with its context", async () => {
    mockAdminApi();
    await openGovernance();

    await screen.findByText("Breakdowns");
    expect(within(kpi("Requests")).getByText("120")).toBeInTheDocument();
    expect(within(kpi("Requests")).getByText("90 answered, 20 replied")).toBeInTheDocument();
    expect(within(kpi("Blocked")).getByText("5")).toBeInTheDocument();
    expect(within(kpi("Blocked")).getByText("3 rate-limited")).toBeInTheDocument();
    expect(within(kpi("Citations verified")).getByText("90%")).toBeInTheDocument();
    expect(within(kpi("Citations verified")).getByText("180 verified, 20 dropped")).toBeInTheDocument();
    expect(within(kpi("p95 latency")).getByText("4.2 s")).toBeInTheDocument();
    expect(within(kpi("p95 latency")).getByText("1.8 s on average")).toBeInTheDocument();
  });

  it("draws the token budget as one gauge, with what the period spent", async () => {
    mockAdminApi();
    await openGovernance();
    const meter = await screen.findByRole("meter", { name: "Token budget used" });
    expect(meter).toHaveAttribute("aria-valuenow", "200000");
    expect(meter).toHaveAttribute("aria-valuemax", "1000000");
    expect(meter).toHaveAttribute("aria-valuetext", "200,000 / 1,000,000 (20%)");
    expect(screen.getByText("This period: 200,000 tokens (150,000 prompt + 50,000 completion)")).toBeInTheDocument();
  });

  it("shows a dash, not 0%, for a citation rate over nothing", async () => {
    mockAdminApi(withSummary(emptySummary));
    await openGovernance();
    await screen.findByText("Breakdowns");
    expect(within(kpi("Citations verified")).getByText("—")).toBeInTheDocument();
  });

  it("asks for the selected time window", async () => {
    const fetchMock = mockAdminApi();
    const user = await openGovernance();
    await screen.findByText("Breakdowns");
    const hoursAsked = () => callsTo(fetchMock, HTTP_METHOD.GET, API_PATH.governanceSummary).map((call) => call.url.searchParams.get("hours"));
    expect(hoursAsked()).toContain("24");

    await user.selectOptions(screen.getByLabelText("Time window"), "Last 7 days");
    await waitFor(() => expect(hoursAsked()).toContain("168"));
    await user.selectOptions(screen.getByLabelText("Time window"), "Last 30 days");
    await waitFor(() => expect(hoursAsked()).toContain("720"));
  });

  it("offers the time window only where it applies", async () => {
    mockAdminApi();
    const user = await openGovernance();
    expect(await screen.findByLabelText("Time window")).toBeInTheDocument();
    await openPart(user, "Requests");
    expect(screen.queryByLabelText("Time window")).not.toBeInTheDocument();
  });

  it("shows an error with a retry when the summary cannot be loaded", async () => {
    mockAdminApi(adminRoute(API_PATH.governanceSummary, () => errorResponse(ERROR_CODE.UNAVAILABLE, 503, { requestId: "req-sum" })));
    await openGovernance();
    expect(await screen.findByText(/Reference: req-sum/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("AI governance: breakdowns", () => {
  const expectBars = (name: string, rows: Array<[string, string]>) => {
    const list = screen.getByRole("list", { name });
    for (const [label, value] of rows) {
      const row = within(list).getByText(label).closest("li") as HTMLElement;
      expect(within(row).getByText(value)).toBeInTheDocument(); // the number is text, not just a bar
    }
  };

  it("shows how requests turned out and the verdicts at once", async () => {
    mockAdminApi();
    await openGovernance();
    await screen.findByText("Breakdowns");
    expectBars("Outcomes", [["Answered", "90"], ["Replied", "20"], ["Blocked", "5"], ["Error", "2"]]);
    expectBars("Verdicts", [["Appears covered", "40"], ["Appears not covered", "30"]]);
  });

  it("keeps the other six behind \"More breakdowns\"", async () => {
    mockAdminApi();
    const user = await openGovernance();
    await screen.findByText("Breakdowns");
    await user.click(screen.getByText("More breakdowns"));

    expectBars("Intents", [["Claim", "100"], ["Small talk", "15"]]);
    expectBars("Confidence", [["High", "50"], ["Medium", "30"], ["Low", "10"]]);
    expectBars("Models", [["gpt-5", "90"], ["gpt-5-mini", "30"]]);
    expectBars("Tools used", [["Search policy", "70"], ["Read section", "45"]]);
    expectBars("Guardrail flags", [["Personal data redacted", "12"], ["Injection pattern", "5"]]);
    expectBars("Tokens by model tier", [["Reasoning model", "180,000"], ["Small model", "20,000"]]);
  });

  it("orders each list from the biggest count down and leaves out zeros", async () => {
    mockAdminApi();
    await openGovernance();
    await screen.findByText("Breakdowns");
    const labels = within(screen.getByRole("list", { name: "Outcomes" })).getAllByRole("listitem").map((item) => item.firstElementChild?.textContent);
    expect(labels).toEqual(["Answered", "Replied", "Blocked", "Rate-limited", "Error"]);
  });

  it("says there is no data, instead of drawing empty charts", async () => {
    mockAdminApi(withSummary(emptySummary));
    await openGovernance();
    await screen.findByText("Breakdowns");
    expect(screen.getAllByText("No data in this time window.")).toHaveLength(8);
    expect(screen.queryByRole("list", { name: "Outcomes" })).not.toBeInTheDocument();
  });
});

describe("AI governance: requests", () => {
  const openRequests = async (extra: Parameters<typeof mockAdminApi>[0] = {}) => {
    const fetchMock = mockAdminApi(extra);
    const user = await openGovernance();
    await openPart(user, "Requests");
    const table = await screen.findByRole("table", { name: "Recent AI requests" });
    return { user, fetchMock, table };
  };
  const dataRows = (table: HTMLElement) => within(table).getAllByRole("row").slice(1);

  it("lists each request on one line: time, outcome, what it was, tokens, latency and any guardrail", async () => {
    const { table } = await openRequests();
    const rows = dataRows(table);
    expect(rows).toHaveLength(3);
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Time",
      "Outcome",
      "What it was",
      "Tokens",
      "Latency",
      "Guardrails",
      "Details",
    ]);

    const first = within(rows[0]!);
    expect(first.getByText("Answered")).toBeInTheDocument();
    expect(first.getByText("Claim · Appears not covered · High")).toBeInTheDocument();
    expect(first.getByText("1,500")).toBeInTheDocument();
    expect(first.getByText("2.1 s")).toBeInTheDocument();
    expect(first.queryByText("Injection pattern")).not.toBeInTheDocument(); // nothing fired: nothing shown

    const second = within(rows[1]!);
    expect(second.getByText("Replied")).toBeInTheDocument();
    expect(second.getByText("Small talk")).toBeInTheDocument();

    const third = within(rows[2]!);
    expect(third.getByText("Blocked")).toBeInTheDocument();
    expect(third.getByText("Injection pattern")).toBeInTheDocument();
  });

  it("keeps the rest of a request out of the way until it is opened", async () => {
    const { table } = await openRequests();
    expect(within(table).queryByText("req-a")).not.toBeInTheDocument();
    expect(within(table).queryByText("Your own key")).not.toBeInTheDocument();
    for (const button of within(table).getAllByRole("button", { name: "Details" })) expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("opens one request at a time to show its models, tokens, tools, citations and credentials", async () => {
    const { user, table } = await openRequests();
    await user.click(within(dataRows(table)[0]!).getByRole("button", { name: "Details" }));

    const open = within(table);
    expect(open.getByText("req-a", { selector: "code" })).toBeInTheDocument();
    expect(open.getByText("gpt-5", { selector: "code" })).toBeInTheDocument();
    expect(open.getByText("1,200 prompt + 300 completion · Reasoning model: 1,500")).toBeInTheDocument();
    expect(open.getByText("3 steps: Search policy")).toBeInTheDocument();
    expect(open.getByText("2 verified, 0 dropped")).toBeInTheDocument();
    expect(open.getByText("Your own key")).toBeInTheDocument();
    expect(open.getByRole("button", { name: "Hide details" })).toHaveAttribute("aria-expanded", "true");

    // Opening another closes the first.
    await user.click(within(table).getAllByRole("button", { name: "Details" })[0]!);
    expect(open.queryByText("req-a", { selector: "code" })).not.toBeInTheDocument();
    expect(open.getByText("req-b", { selector: "code" })).toBeInTheDocument();
    expect(open.getByText("Server")).toBeInTheDocument();
  });

  it("shows a blocked request's error code and redacted excerpt as plain text, with no conversation to open", async () => {
    const { user, table } = await openRequests();
    await user.click(within(dataRows(table)[2]!).getByRole("button", { name: "Details" }));

    expect(within(table).getByText("guardrail_blocked", { selector: "code" })).toBeInTheDocument();
    expect(within(table).getByText(BLOCKED_EXCERPT, { exact: false })).toBeInTheDocument();
    expect(table.querySelector("script")).toBeNull(); // the markup in the excerpt was not interpreted
    expect(screen.queryByRole("button", { name: "View conversation" })).not.toBeInTheDocument();
  });

  it("opens the conversation an answered request led to, and returns to the list when the tab is chosen again", async () => {
    const { user, table } = await openRequests(adminRoute(conversationPath("req-a"), () => jsonResponse(conversationDetail({ request_id: "req-a" }))));
    await user.click(within(dataRows(table)[0]!).getByRole("button", { name: "Details" }));
    await user.click(screen.getByRole("button", { name: "View conversation" }));

    expect(await screen.findByRole("heading", { name: "Conversation" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Conversations" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("req-a", { selector: "code" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "AI governance" }));
    await user.click(screen.getByRole("tab", { name: "Conversations" }));
    expect(await screen.findByRole("table", { name: "Conversations" })).toBeInTheDocument(); // the list, not req-a
  });

  it("offers the conversation of a short reply too", async () => {
    const { user, table } = await openRequests();
    await user.click(within(dataRows(table)[1]!).getByRole("button", { name: "Details" }));
    expect(screen.getByRole("button", { name: "View conversation" })).toBeInTheDocument();
  });

  it("asks the server for one outcome at a time when a filter is chosen", async () => {
    const blockedOnly: AiEvent[] = events.filter((event) => event.outcome === "blocked");
    const { user, fetchMock, table } = await openRequests(
      adminRoute(API_PATH.governanceEvents, ({ url }) => jsonResponse(url.searchParams.get("outcome") === "blocked" ? blockedOnly : events)),
    );
    expect(dataRows(table)).toHaveLength(3);

    const filter = screen.getByLabelText("Filter by outcome");
    expect(within(filter).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "All outcomes",
      "Answered",
      "Replied",
      "Blocked",
      "Rate-limited",
      "Locked out",
      "Budget exhausted",
      "Error",
    ]);
    expect(OUTCOMES).toHaveLength(7);

    await user.selectOptions(filter, "Blocked");
    await waitFor(() => expect(dataRows(screen.getByRole("table", { name: "Recent AI requests" }))).toHaveLength(1));
    const calls = callsTo(fetchMock, HTTP_METHOD.GET, API_PATH.governanceEvents);
    expect(calls.at(-1)?.url.searchParams.get("outcome")).toBe("blocked");
    expect(calls[0]?.url.searchParams.has("outcome")).toBe(false);

    await user.selectOptions(filter, "All outcomes");
    await waitFor(() => expect(dataRows(screen.getByRole("table", { name: "Recent AI requests" }))).toHaveLength(3));
    expect(callsTo(fetchMock, HTTP_METHOD.GET, API_PATH.governanceEvents).at(-1)?.url.searchParams.has("outcome")).toBe(false);
  });

  it("says when nothing matches", async () => {
    mockAdminApi(adminRoute(API_PATH.governanceEvents, () => jsonResponse([])));
    const user = await openGovernance();
    await openPart(user, "Requests");
    expect(await screen.findByText("No requests match this filter.")).toBeInTheDocument();
  });
});

describe("AI governance: rules", () => {
  const openRules = async () => {
    mockAdminApi();
    const user = await openGovernance();
    await openPart(user, "Rules");
    const section = (await screen.findByText("Active policy")).closest("section") as HTMLElement;
    await within(section).findByRole("table", { name: "Model tiers" });
    return section;
  };

  it("shows tiers, skills, tools, guards by stage, limits and the secrets posture", async () => {
    const section = await openRules();

    const tiers = within(within(section).getByRole("table", { name: "Model tiers" }));
    const reasoning = within(tiers.getByText("gpt-5").closest("tr") as HTMLElement);
    expect(reasoning.getByText("Reasoning model")).toBeInTheDocument();
    expect(reasoning.getByText("4,000")).toBeInTheDocument();
    expect(reasoning.getByText("60 s")).toBeInTheDocument();
    expect(reasoning.getByText("Medium")).toBeInTheDocument();

    const skills = within(within(section).getByRole("table", { name: "Skills" }));
    const coverage = within(skills.getByText("Coverage").closest("tr") as HTMLElement);
    expect(coverage.getByText("2.0")).toBeInTheDocument();
    expect(coverage.getByText("Search policy, Read section")).toBeInTheDocument();
    expect(coverage.getByText("6")).toBeInTheDocument();

    expect(within(section).getByText("Search the contract passages.")).toBeInTheDocument();

    expect(within(section).getByText("Input guards")).toBeInTheDocument();
    expect(within(section).getByText("Output guards")).toBeInTheDocument();
    expect(within(section).getByText("Masks personal data before the model sees it.")).toBeInTheDocument();
    expect(within(section).getByText("Citation verifier")).toBeInTheDocument();

    const limits = within(within(section).getByRole("table", { name: "Limits" }));
    expect(within(limits.getByText("Requests per minute (per client)").closest("tr") as HTMLElement).getByText("10")).toBeInTheDocument();
    expect(within(limits.getByText("Lock-out duration").closest("tr") as HTMLElement).getByText("900 s")).toBeInTheDocument();
    expect(within(limits.getByText("Daily tokens (all clients)").closest("tr") as HTMLElement).getByText("1,000,000")).toBeInTheDocument();
    expect(limits.getAllByRole("row")).toHaveLength(Object.keys(policy.limits).length + 1);

    expect(within(section).getByText("Stored hashed")).toBeInTheDocument();
    expect(within(section).getByText("Managed identity")).toBeInTheDocument();
    expect(within(section).getByText("Redacted")).toBeInTheDocument();
    expect(within(section).getByText("Stored as is")).toBeInTheDocument(); // client addresses: not pseudonymised in the fixture
  });

  it("is read-only: no inputs or buttons besides retry", async () => {
    const section = await openRules();
    expect(within(section).queryAllByRole("textbox")).toHaveLength(0);
    expect(within(section).queryAllByRole("button")).toHaveLength(0);
  });
});

describe("AI governance: French", () => {
  it("is fully translated", async () => {
    mockAdminApi();
    const user = await openGovernance({ language: "fr" });

    expect(await screen.findByText("À surveiller")).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Sections de la gouvernance" })).toBeInTheDocument();
    expect(within(kpi("Requêtes")).getByText("120")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Résultats" })).toBeInTheDocument();
    expect(screen.getByLabelText("Période")).toBeInTheDocument();
    expect(screen.getByText(/Budget global de jetons/)).toBeInTheDocument();

    await openPart(user, "Requêtes");
    const table = await screen.findByRole("table", { name: "Requêtes IA récentes" });
    await user.click(within(table).getAllByRole("button", { name: "Détails" })[0]!);
    expect(within(table).getByRole("button", { name: "Masquer les détails" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voir la conversation" })).toBeInTheDocument();

    await openPart(user, "Règles");
    expect(await screen.findByRole("table", { name: "Niveaux de modèle" })).toBeInTheDocument();
  });
});
