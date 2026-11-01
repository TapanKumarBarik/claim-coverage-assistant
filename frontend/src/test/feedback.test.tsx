import { screen, waitFor, within } from "@testing-library/react";
import { API_PATH } from "../api/paths";
import { ERROR_CODE } from "../constants/domain";
import { HTTP_METHOD } from "../constants/http";
import { assessment, GENERATED_AT, reply } from "./fixtures";
import { callsTo, defaultRoutes, errorResponse, jsonResponse, mockApi, renderApp, routeKey, type Routes } from "./harness";

const ANALYZE = routeKey(HTTP_METHOD.POST, API_PATH.analyze);
const FEEDBACK = routeKey(HTTP_METHOD.POST, API_PATH.feedback);
const RATED = { rating: "up", comment: null, rated_at: GENERATED_AT };

function chatApi(analyze: Routes[string], feedback: Routes[string] = () => jsonResponse(RATED)) {
  return mockApi({ ...defaultRoutes(), [ANALYZE]: analyze, [FEEDBACK]: feedback });
}

async function ask(user: ReturnType<typeof renderApp>, text = "my bike was stolen") {
  await user.type(await screen.findByLabelText(/what happened/i), `${text}{Enter}`);
}

const feedbackGroup = () => screen.findByRole("group", { name: "Rate this answer" });

describe("Answer time", () => {
  it("shows when an assessment and a short reply were generated, in a machine-readable <time>", async () => {
    chatApi(() => jsonResponse(assessment()));
    const user = renderApp();
    await ask(user);

    const generated = await screen.findByText(/^Generated .*2026/);
    expect(generated.tagName).toBe("TIME");
    expect(generated).toHaveAttribute("datetime", GENERATED_AT);
  });

  it("shows it on a reply too, in French when the interface is French", async () => {
    chatApi(() => jsonResponse(reply("fr")));
    const user = renderApp({ language: "fr" });
    await user.type(await screen.findByLabelText(/que s'est-il passé/i), "bonjour{Enter}");
    expect(await screen.findByText(/^Générée le .*2026/)).toHaveAttribute("datetime", GENERATED_AT);
  });
});

describe("Feedback", () => {
  it("asks 'Was this answer helpful?' at the end of a cited answer, after its footer", async () => {
    chatApi(() => jsonResponse(assessment()));
    const user = renderApp();
    await ask(user);

    const group = await feedbackGroup();
    expect(within(group).getByText("Was this answer helpful?")).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "Like this answer" })).toHaveAttribute("aria-pressed", "false");
    expect(within(group).getByRole("button", { name: "Dislike this answer" })).toHaveAttribute("aria-pressed", "false");

    const footer = screen.getByText(/Answered in 1\.8 s/);
    expect(footer.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("asks on a short reply as well", async () => {
    chatApi(() => jsonResponse(reply()));
    const user = renderApp();
    await ask(user, "hello");
    expect(await feedbackGroup()).toBeInTheDocument();
  });

  it("saves a like at once, shows it as chosen and says thanks", async () => {
    const fetchMock = chatApi(() => jsonResponse(assessment()));
    const user = renderApp();
    await ask(user);

    await user.click(await screen.findByRole("button", { name: "Like this answer" }));

    expect(await screen.findByText("Thanks for your feedback.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Like this answer" })).toHaveAttribute("aria-pressed", "true");
    expect(callsTo(fetchMock, HTTP_METHOD.POST, API_PATH.feedback).map((call) => call.body)).toEqual([
      { request_id: "req-123", rating: "up", comment: null },
    ]);
    expect(screen.queryByLabelText(/what went wrong/i)).not.toBeInTheDocument(); // a like needs no explanation
  });

  it("saves a dislike, then offers an optional comment and saves that too", async () => {
    const fetchMock = chatApi(() => jsonResponse(assessment()), ({ body }) => jsonResponse({ ...RATED, ...(body as object) }));
    const user = renderApp();
    await ask(user);

    await user.click(await screen.findByRole("button", { name: "Dislike this answer" }));
    const box = await screen.findByLabelText("What went wrong? (optional)");
    expect(screen.getByRole("button", { name: "Dislike this answer" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Send comment" })).toBeDisabled(); // nothing to send yet

    await user.type(box, "It ignored the date of loss.");
    await user.click(screen.getByRole("button", { name: "Send comment" }));

    expect(await screen.findByText("Thanks, your comment was saved.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/what went wrong/i)).not.toBeInTheDocument();
    expect(callsTo(fetchMock, HTTP_METHOD.POST, API_PATH.feedback).map((call) => call.body)).toEqual([
      { request_id: "req-123", rating: "down", comment: null },
      { request_id: "req-123", rating: "down", comment: "It ignored the date of loss." },
    ]);
  });

  it("lets the visitor change their mind, which drops the comment box", async () => {
    chatApi(() => jsonResponse(assessment()));
    const user = renderApp();
    await ask(user);

    await user.click(await screen.findByRole("button", { name: "Dislike this answer" }));
    await screen.findByLabelText(/what went wrong/i);
    await user.click(screen.getByRole("button", { name: "Like this answer" }));

    await waitFor(() => expect(screen.queryByLabelText(/what went wrong/i)).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Like this answer" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Dislike this answer" })).toHaveAttribute("aria-pressed", "false");
  });

  it("does not send the same rating twice", async () => {
    const fetchMock = chatApi(() => jsonResponse(assessment()));
    const user = renderApp();
    await ask(user);

    const like = await screen.findByRole("button", { name: "Like this answer" });
    await user.click(like);
    await screen.findByText("Thanks for your feedback.");
    await user.click(like);
    expect(callsTo(fetchMock, HTTP_METHOD.POST, API_PATH.feedback)).toHaveLength(1);
  });

  it("says so, and does not pretend the rating was saved, when it could not be", async () => {
    chatApi(() => jsonResponse(assessment()), () => errorResponse(ERROR_CODE.RATE_LIMITED, 429));
    const user = renderApp();
    await ask(user);

    await user.click(await screen.findByRole("button", { name: "Like this answer" }));

    expect(await screen.findByText("We could not save your feedback. Please try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Like this answer" })).toHaveAttribute("aria-pressed", "false");
  });

  it("is not offered while the answer is still being written, or when the message failed", async () => {
    chatApi(() => errorResponse(ERROR_CODE.UNAVAILABLE, 503));
    const user = renderApp();
    await ask(user);
    await screen.findByRole("alert");
    expect(screen.queryByRole("group", { name: "Rate this answer" })).not.toBeInTheDocument();
  });

  it("rates each answer separately, and a re-run is a new answer that can be rated again", async () => {
    const fetchMock = chatApi(() => jsonResponse(assessment()));
    const user = renderApp();
    await ask(user, "first question");
    await user.click(await screen.findByRole("button", { name: "Like this answer" }));
    await screen.findByText("Thanks for your feedback.");

    await ask(user, "second question");
    await waitFor(() => expect(screen.getAllByRole("group", { name: "Rate this answer" })).toHaveLength(2));
    const second = screen.getAllByRole("group", { name: "Rate this answer" })[1]!;
    expect(within(second).getByRole("button", { name: "Like this answer" })).toHaveAttribute("aria-pressed", "false");
    expect(callsTo(fetchMock, HTTP_METHOD.POST, API_PATH.feedback)).toHaveLength(1);
  });

  it("speaks French when the interface is French", async () => {
    chatApi(() => jsonResponse(assessment("fr")));
    const user = renderApp({ language: "fr" });
    await user.type(await screen.findByLabelText(/que s'est-il passé/i), "mon vélo{Enter}");

    const group = await screen.findByRole("group", { name: "Évaluer cette réponse" });
    expect(within(group).getByText("Cette réponse vous a-t-elle été utile ?")).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "J'aime cette réponse" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "Je n'aime pas cette réponse" })).toBeInTheDocument();
  });
});

describe("Privacy notice", () => {
  it("tells visitors that conversations are saved, and what is masked", async () => {
    chatApi(() => jsonResponse(reply()));
    renderApp();
    expect(await screen.findByText(/Conversations are saved for quality review/)).toBeInTheDocument();
  });
});
