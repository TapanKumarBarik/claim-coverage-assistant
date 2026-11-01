import { screen, waitFor, within } from "@testing-library/react";
import { API_PATH, conversationPath } from "../api/paths";
import type { ConversationPage } from "../api/types";
import { ROUTE } from "../app/routes";
import { ERROR_CODE } from "../constants/domain";
import { HTTP_METHOD } from "../constants/http";
import { adminRoute, adminSession, asAdmin, mockAdminApi } from "./adminHarness";
import { conversationDetail, conversationPage, conversationRows, feedbackStats, QUESTION } from "./fixtures";
import { callsTo, errorResponse, jsonResponse, renderApp, routeKey } from "./harness";

const FIRST = conversationRows[0]!;

async function openConversations(extra: Parameters<typeof mockAdminApi>[0] = {}) {
  const fetchMock = mockAdminApi(extra);
  adminSession.signIn();
  const user = renderApp({ route: ROUTE.ADMIN });
  await user.click(await screen.findByRole("tab", { name: "Conversations" }));
  return { user, fetchMock };
}

const listCalls = (fetchMock: Awaited<ReturnType<typeof openConversations>>["fetchMock"]) =>
  callsTo(fetchMock, HTTP_METHOD.GET, API_PATH.adminConversations);

describe("Admin conversations: the table", () => {
  it("lists every conversation with when it was generated, the question, the answer and the feedback", async () => {
    await openConversations();

    const table = await screen.findByRole("table", { name: "Conversations" });
    const rows = within(table).getAllByRole("row").slice(1); // without the header
    expect(rows).toHaveLength(3);

    const [disliked, liked, unrated] = rows.map((row) => within(row)) as [ReturnType<typeof within>, ReturnType<typeof within>, ReturnType<typeof within>];
    expect(disliked.getByRole("button", { name: new RegExp(QUESTION) })).toBeInTheDocument();
    expect(disliked.getByText("Appears not covered")).toBeInTheDocument();
    expect(disliked.getByText("Disliked")).toBeInTheDocument();
    expect(disliked.getByRole("img", { name: "With a comment" })).toBeInTheDocument();
    expect(disliked.getByText(/29 Oct 2026/)).toBeInTheDocument();

    expect(liked.getByText("Short reply")).toBeInTheDocument(); // a reply has no verdict
    expect(liked.getByText("Liked")).toBeInTheDocument();
    expect(liked.queryByRole("img", { name: "With a comment" })).not.toBeInTheDocument();

    expect(unrated.getByText("Unclear")).toBeInTheDocument();
    expect(unrated.getByText("Not rated")).toBeInTheDocument();
  });

  it("shows the feedback totals and the satisfaction rate", async () => {
    await openConversations();
    const stat = (label: string) => screen.getByText(label, { selector: "dt" }).parentElement as HTMLElement;

    await screen.findByText("Satisfaction");
    expect(within(stat("Conversations")).getByText("3")).toBeInTheDocument();
    expect(within(stat("Rated")).getByText("2")).toBeInTheDocument();
    expect(within(stat("Liked")).getByText("1")).toBeInTheDocument();
    expect(within(stat("Disliked")).getByText("1")).toBeInTheDocument();
    expect(within(stat("Satisfaction")).getByText("50%")).toBeInTheDocument();
    expect(within(stat("Satisfaction")).getByText("1 of 2 rated answers liked")).toBeInTheDocument();
  });

  it("shows a dash, not 0%, while nothing has been rated", async () => {
    await openConversations(
      adminRoute(API_PATH.adminConversationStats, () => jsonResponse({ ...feedbackStats, rated: 0, up: 0, down: 0, satisfaction: null })),
    );
    const satisfaction = (await screen.findByText("Satisfaction", { selector: "dt" })).parentElement as HTMLElement;
    expect(within(satisfaction).getByText("—")).toBeInTheDocument();
    expect(within(satisfaction).getByText("Nothing rated yet")).toBeInTheDocument();
  });

  it("explains that questions are kept with personal data masked", async () => {
    await openConversations();
    expect(await screen.findByText(/masked, and are removed automatically/)).toBeInTheDocument();
  });

  it("says so when there are no conversations yet", async () => {
    const empty: ConversationPage = { total: 0, limit: 25, offset: 0, items: [] };
    await openConversations(adminRoute(API_PATH.adminConversations, () => jsonResponse(empty)));
    expect(await screen.findByText(/No conversations yet/)).toBeInTheDocument();
  });

  it("shows the question as plain text, whatever the visitor typed", async () => {
    const hostile = { ...FIRST, preview: '<img src=x onerror="alert(1)"> <b>bold</b>' };
    await openConversations(adminRoute(API_PATH.adminConversations, () => jsonResponse({ ...conversationPage, items: [hostile] })));
    expect(await screen.findByText(/<img src=x onerror="alert\(1\)"> <b>bold<\/b>/)).toBeInTheDocument();
    expect(document.querySelector("img[src='x']")).toBeNull();
  });
});

describe("Admin conversations: filters and paging", () => {
  it("asks only for liked, disliked or unrated conversations, and goes back to all", async () => {
    const { user, fetchMock } = await openConversations();
    await screen.findByRole("table", { name: "Conversations" });

    await user.selectOptions(screen.getByLabelText("Filter by feedback"), "Disliked");
    await waitFor(() => expect(listCalls(fetchMock).at(-1)?.url.searchParams.get("feedback")).toBe("down"));
    await user.selectOptions(screen.getByLabelText("Filter by feedback"), "Not rated yet");
    await waitFor(() => expect(listCalls(fetchMock).at(-1)?.url.searchParams.get("feedback")).toBe("unrated"));
    await user.selectOptions(screen.getByLabelText("Filter by feedback"), "All conversations");
    await waitFor(() => expect(listCalls(fetchMock).at(-1)?.url.searchParams.has("feedback")).toBe(false));
  });

  it("searches once the visitor stops typing, not on every keystroke", async () => {
    const { user, fetchMock } = await openConversations();
    await screen.findByRole("table", { name: "Conversations" });
    const before = listCalls(fetchMock).length;

    await user.type(screen.getByLabelText("Search"), "bike");
    await waitFor(() => expect(listCalls(fetchMock).at(-1)?.url.searchParams.get("q")).toBe("bike"), { timeout: 3000 });
    expect(listCalls(fetchMock).length - before).toBeLessThanOrEqual(2); // not one request per letter
  });

  it("says nothing matches, rather than that there are no conversations, when a filter finds none", async () => {
    const none: ConversationPage = { total: 0, limit: 25, offset: 0, items: [] };
    const { user } = await openConversations(
      adminRoute(API_PATH.adminConversations, ({ url }) => jsonResponse(url.searchParams.has("feedback") ? none : conversationPage)),
    );
    await screen.findByRole("table", { name: "Conversations" });
    await user.selectOptions(screen.getByLabelText("Filter by feedback"), "Liked");
    expect(await screen.findByText("No conversations match these filters.")).toBeInTheDocument();
  });

  it("pages through a long list 25 at a time", async () => {
    const page = (offset: number): ConversationPage => ({ total: 60, limit: 25, offset, items: conversationRows });
    const { user, fetchMock } = await openConversations(
      adminRoute(API_PATH.adminConversations, ({ url }) => jsonResponse(page(Number(url.searchParams.get("offset") ?? 0)))),
    );

    const pages = await screen.findByRole("navigation", { name: "Pages" });
    expect(within(pages).getByText("1–25 of 60")).toBeInTheDocument();
    expect(within(pages).getByRole("button", { name: "Previous" })).toBeDisabled();

    await user.click(within(pages).getByRole("button", { name: "Next" }));
    expect(await screen.findByText("26–50 of 60")).toBeInTheDocument();
    expect(listCalls(fetchMock).at(-1)?.url.searchParams.get("offset")).toBe("25");

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("51–60 of 60")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("shows an error with a retry button when the list cannot load", async () => {
    await openConversations(adminRoute(API_PATH.adminConversations, () => errorResponse(ERROR_CODE.UNAVAILABLE, 503)));
    expect(await screen.findByRole("alert")).toHaveTextContent("busy or not available");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("Admin conversations: one conversation", () => {
  const open = async (extra: Parameters<typeof mockAdminApi>[0] = {}) => {
    const context = await openConversations(extra);
    await context.user.click(await screen.findByRole("button", { name: new RegExp(QUESTION) }));
    return context;
  };

  it("shows the question, the answer as the visitor saw it, and the feedback with its comment", async () => {
    await open();

    expect(await screen.findByRole("heading", { name: "Conversation" })).toBeInTheDocument();
    expect(screen.getByText(QUESTION, { selector: ".conversation-question" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /not covered because the shared room/i })).toBeInTheDocument(); // the full answer
    expect(screen.getByText("Disliked")).toBeInTheDocument();
    expect(screen.getByText("It ignored the date of loss.")).toBeInTheDocument();
    expect(screen.getByText(/^Generated .*2026/)).toBeInTheDocument();
    expect(screen.getByText("req-123", { selector: "code" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /relancer|run again/i })).not.toBeInTheDocument(); // read-only
    expect(screen.queryByRole("group", { name: "Rate this answer" })).not.toBeInTheDocument(); // the admin does not rate
  });

  it("says when nothing was rated", async () => {
    await open(adminRoute(conversationPath(FIRST.request_id), () => jsonResponse(conversationDetail({ rating: null, rated_at: null, comment: null, has_comment: false }))));
    expect(await screen.findByText("No feedback yet.")).toBeInTheDocument();
  });

  it("still opens a conversation whose answer was saved in a format this version cannot read", async () => {
    await open(adminRoute(conversationPath(FIRST.request_id), () => jsonResponse(conversationDetail({ response: null }))));
    expect(await screen.findByText(/saved in a format this version cannot display/)).toBeInTheDocument();
    expect(screen.getByText(QUESTION, { selector: ".conversation-question" })).toBeInTheDocument();
  });

  it("goes back to the list", async () => {
    const { user } = await open();
    await user.click(await screen.findByRole("button", { name: /All conversations/ }));
    expect(await screen.findByRole("table", { name: "Conversations" })).toBeInTheDocument();
  });

  it("deletes a conversation only after confirmation, then returns to the list", async () => {
    const remove = routeKey(HTTP_METHOD.DELETE, conversationPath(FIRST.request_id));
    const { user, fetchMock } = await open({ [remove]: asAdmin(() => jsonResponse(null, 204)) });

    await user.click(await screen.findByRole("button", { name: "Delete this conversation" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Permanently delete this conversation and its feedback?");
    expect(callsTo(fetchMock, HTTP_METHOD.DELETE, conversationPath(FIRST.request_id))).toHaveLength(0); // nothing yet

    await user.click(within(dialog).getByRole("button", { name: "Delete conversation" }));
    await waitFor(() => expect(callsTo(fetchMock, HTTP_METHOD.DELETE, conversationPath(FIRST.request_id))).toHaveLength(1));
    expect(await screen.findByRole("table", { name: "Conversations" })).toBeInTheDocument();
  });

  it("keeps the conversation and explains when it cannot be deleted", async () => {
    const remove = routeKey(HTTP_METHOD.DELETE, conversationPath(FIRST.request_id));
    const { user } = await open({ [remove]: asAdmin(() => errorResponse(ERROR_CODE.NOT_FOUND, 404)) });

    await user.click(await screen.findByRole("button", { name: "Delete this conversation" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete conversation" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("could not find what you asked for");
    expect(screen.getByText(QUESTION, { selector: ".conversation-question" })).toBeInTheDocument();
  });
});

describe("Admin conversations: French", () => {
  it("is fully translated", async () => {
    const fetchMock = mockAdminApi();
    adminSession.signIn();
    const user = renderApp({ route: ROUTE.ADMIN, language: "fr" });
    await user.click(await screen.findByRole("tab", { name: "Conversations" }));

    expect(await screen.findByRole("table", { name: "Conversations" })).toBeInTheDocument();
    expect(screen.getByText("Pas d'avis")).toBeInTheDocument();
    expect(screen.getByText("Non aimée")).toBeInTheDocument();
    expect(screen.getByLabelText("Filtrer par avis")).toBeInTheDocument();
    expect(screen.getByText("Satisfaction")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
  });
});
