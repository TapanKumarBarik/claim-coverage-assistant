import { screen, waitFor, within } from "@testing-library/react";
import { API_PATH } from "../api/paths";
import { ERROR_CODE } from "../constants/domain";
import { HTTP_METHOD } from "../constants/http";
import { ROUTE } from "../app/routes";
import { assessment, contracts, examples, noSession, noSessionAndNoByo, reply, serverSession } from "./fixtures";
import { callsTo, defaultRoutes, errorResponse, jsonResponse, mockApi, renderApp, routeKey, type Routes } from "./harness";

const ANALYZE = routeKey(HTTP_METHOD.POST, API_PATH.analyze);
const SESSION = routeKey(HTTP_METHOD.GET, API_PATH.session);
const EXAMPLE_BUTTON = "Bike stolen from storage room";
const SEND = "Check coverage";
const BOX = /what happened/i;
const EXAMPLE_CLAIM = examples[0]!.claim.en!; // the English text of the first example

function assistantApi(analyze: Routes[string], extra: Routes = {}) {
  return mockApi({ ...defaultRoutes(), [ANALYZE]: analyze, ...extra });
}

const sendButton = () => screen.getByRole("button", { name: SEND });
const thread = () => within(screen.getByRole("log"));

async function askWithExample(user: ReturnType<typeof renderApp>) {
  await user.click(await screen.findByRole("button", { name: EXAMPLE_BUTTON }));
  await user.click(sendButton());
}

async function say(user: ReturnType<typeof renderApp>, text: string) {
  await user.type(await screen.findByLabelText(BOX), text);
  await user.click(sendButton());
}

describe("Assistant: the empty chat", () => {
  it("says what it is for, offers examples and lists the documents it will read", async () => {
    assistantApi(() => jsonResponse(reply()));
    const user = renderApp();

    expect(await screen.findByRole("heading", { name: "Is your claim covered?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: EXAMPLE_BUTTON })).toBeInTheDocument();
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    expect(sendButton()).toBeDisabled();

    await user.click(screen.getByText("Documents on file"));
    expect(screen.getByText(contracts[0]!.documents[0]!.title)).toBeVisible();
  });
});

describe("Assistant: assessment", () => {
  it("fills the box from an example, sends it and shows the question with a cited, highlighted answer", async () => {
    const fetchMock = assistantApi(() => jsonResponse(assessment()));
    const user = renderApp();

    await user.click(await screen.findByRole("button", { name: EXAMPLE_BUTTON }));
    const box = screen.getByLabelText(BOX);
    expect(box).toHaveValue(EXAMPLE_CLAIM);
    expect(box).toHaveFocus();
    await user.click(sendButton());

    expect(thread().getByText(EXAMPLE_CLAIM)).toBeInTheDocument();
    expect(await thread().findByRole("heading", { name: /not covered because the shared room/i })).toBeInTheDocument();
    expect(screen.getByText("Appears not covered")).toBeInTheDocument();
    expect(screen.getByText(/Confidence: High/)).toBeInTheDocument();
    expect(screen.getByText("Based on the contract text")).toBeInTheDocument();
    expect(screen.getByText(/Was there any sign of forced entry/)).toBeInTheDocument();
    expect(screen.getByText(/fictional demo data/)).toBeInTheDocument();
    expect(screen.getByText(/Answered in 1\.8 s/)).toBeInTheDocument();
    expect(box).toHaveValue(""); // the box is ready for the next message

    const [call] = callsTo(fetchMock, HTTP_METHOD.POST, API_PATH.analyze);
    expect(call?.body).toMatchObject({ contract_id: contracts[0]!.id, language: "en", claim: EXAMPLE_CLAIM });

    await user.click(screen.getByRole("button", { name: "Show full passage" }));
    expect(document.querySelector("mark")?.textContent).toBe("n'est garanti que si deux conditions sont réunies");
  });

  it("announces answers in a polite log and does not take focus away from the message box", async () => {
    assistantApi(() => jsonResponse(assessment()));
    const user = renderApp();
    await user.type(await screen.findByLabelText(BOX), "my bike was stolen{Enter}");

    const heading = await screen.findByRole("heading", { name: /not covered because/i });
    expect(heading.closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByLabelText(BOX)).toHaveFocus();
  });

  it("shows a working indicator until the answer arrives", async () => {
    let finish: (response: Response) => void = () => undefined;
    assistantApi(() => new Promise<Response>((resolve) => (finish = resolve)));
    const user = renderApp();
    await say(user, "my bike was stolen");

    expect(await thread().findByText("Reading the policy documents…")).toBeInTheDocument();
    expect(sendButton()).toBeDisabled(); // one answer at a time
    finish(jsonResponse(assessment()));
    expect(await thread().findByText("Appears not covered")).toBeInTheDocument();
    expect(thread().queryByText("Reading the policy documents…")).not.toBeInTheDocument();
  });

  it("offers to re-run an answer that is in the other language, and replaces it in place", async () => {
    const fetchMock = assistantApi(() => jsonResponse(assessment("en")));
    const user = renderApp();
    await askWithExample(user);
    await screen.findByText("Appears not covered");

    await user.click(screen.getByRole("button", { name: "FR" }));
    fetchMock.mockClear();
    await user.click(screen.getByRole("button", { name: /relancer en français/i }));

    await waitFor(() => expect(callsTo(fetchMock, HTTP_METHOD.POST, API_PATH.analyze)).toHaveLength(1));
    expect(callsTo(fetchMock, HTTP_METHOD.POST, API_PATH.analyze)[0]?.body).toMatchObject({ language: "fr" });
    await waitFor(() => expect(screen.getAllByText(EXAMPLE_CLAIM)).toHaveLength(1)); // still one exchange
  });
});

describe("Assistant: the message box", () => {
  it("sends on Enter and adds a line on Shift+Enter", async () => {
    const fetchMock = assistantApi(() => jsonResponse(reply()));
    const user = renderApp();
    const box = await screen.findByLabelText(BOX);

    await user.type(box, "first{Shift>}{Enter}{/Shift}second");
    expect(box).toHaveValue("first\nsecond");
    expect(callsTo(fetchMock, HTTP_METHOD.POST, API_PATH.analyze)).toHaveLength(0);

    await user.type(box, "{Enter}");
    await screen.findByRole("article", { name: "Assistant" });
    expect(callsTo(fetchMock, HTTP_METHOD.POST, API_PATH.analyze)[0]?.body).toMatchObject({ claim: "first\nsecond" });
    expect(box).toHaveValue("");
  });

  it.each(["", "   \n "])("does not send an empty message (%j), by button or by Enter", async (text) => {
    const fetchMock = assistantApi(() => jsonResponse(reply()));
    const user = renderApp();

    const box = await screen.findByLabelText(BOX);
    if (text) await user.type(box, text);
    expect(sendButton()).toBeDisabled();
    await user.type(box, "{Enter}");

    expect(callsTo(fetchMock, HTTP_METHOD.POST, API_PATH.analyze)).toHaveLength(0);
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
  });

  it("sends the message trimmed", async () => {
    const fetchMock = assistantApi(() => jsonResponse(reply()));
    const user = renderApp();
    await say(user, "  hello  ");
    await screen.findByRole("article", { name: "Assistant" });
    expect(callsTo(fetchMock, HTTP_METHOD.POST, API_PATH.analyze)[0]?.body).toMatchObject({ claim: "hello" });
  });

  it("sends the contract and the loss date chosen next to the box", async () => {
    const fetchMock = assistantApi(() => jsonResponse(reply()));
    const user = renderApp();
    const box = await screen.findByLabelText(BOX);

    await user.selectOptions(screen.getByLabelText("Contract"), contracts[0]!.id);
    const date = screen.getByLabelText("Date of loss");
    await user.clear(date);
    await user.type(date, "2025-03-14");
    await user.type(box, "water in the cellar{Enter}");

    await screen.findByRole("article", { name: "Assistant" });
    expect(callsTo(fetchMock, HTTP_METHOD.POST, API_PATH.analyze)[0]?.body).toMatchObject({
      contract_id: contracts[0]!.id,
      loss_date: "2025-03-14",
    });
  });
});

describe("Assistant: the conversation", () => {
  it("answers a one-word message with the small model's reply, without a verdict, evidence or sources", async () => {
    const fetchMock = assistantApi(() => jsonResponse(reply()));
    const user = renderApp();
    await say(user, "hi");

    const card = await screen.findByRole("article", { name: "Assistant" });
    expect(within(card).getByText(/Tell me what happened and I will check your contract/)).toBeInTheDocument();
    expect(within(card).getByText(/model fake-mini/)).toBeInTheDocument();
    expect(thread().getByText("hi")).toBeInTheDocument();

    expect(screen.queryByText(/appears covered|appears not covered|unclear/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Evidence" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Confidence/)).not.toBeInTheDocument();
    expect(callsTo(fetchMock, HTTP_METHOD.POST, API_PATH.analyze)[0]?.body).toMatchObject({ claim: "hi" });
  });

  it("does not offer a re-run for a reply written in the other language", async () => {
    assistantApi(() => jsonResponse(reply("fr")));
    const user = renderApp();
    await say(user, "hello");
    await screen.findByRole("article", { name: "Assistant" });
    expect(screen.queryByRole("button", { name: /run again in/i })).not.toBeInTheDocument();
  });

  it("keeps every exchange, oldest first, as the answers come back", async () => {
    const answers = [reply(), assessment(), reply()];
    assistantApi(() => jsonResponse(answers.shift()));
    const user = renderApp();

    await say(user, "hello");
    await thread().findByText(/Tell me what happened/);
    await say(user, "my bike was stolen");
    await thread().findByText("Appears not covered");
    await say(user, "thanks");
    await waitFor(() => expect(screen.getAllByRole("article", { name: "Assistant" })).toHaveLength(2));

    const text = screen.getByRole("log").textContent ?? "";
    expect(text.indexOf("hello")).toBeLessThan(text.indexOf("my bike was stolen"));
    expect(text.indexOf("my bike was stolen")).toBeLessThan(text.indexOf("thanks"));
    expect(screen.getByText("Appears not covered")).toBeInTheDocument();
  });

  it("starts over with New chat", async () => {
    assistantApi(() => jsonResponse(assessment()));
    const user = renderApp();
    await askWithExample(user);
    await screen.findByText("Appears not covered");

    await user.click(screen.getByRole("button", { name: "New chat" }));

    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Is your claim covered?" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New chat" })).not.toBeInTheDocument();
  });
});

describe("Assistant: errors", () => {
  it("explains a rate limit in plain language, with the wait time and a reference", async () => {
    assistantApi(() => errorResponse(ERROR_CODE.RATE_LIMITED, 429, { requestId: "req-9", headers: { "Retry-After": "12" } }));
    const user = renderApp();
    await askWithExample(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("try again in 12 seconds");
    expect(screen.getByText(/Reference: req-9/)).toBeInTheDocument();
  });

  it("shows a network failure as a friendly message", async () => {
    assistantApi(() => {
      throw new TypeError("Failed to fetch");
    });
    const user = renderApp();
    await askWithExample(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot reach the server/i);
  });

  it("retries a failed message in place, without repeating the question in the thread", async () => {
    const answers = [() => errorResponse(ERROR_CODE.UNAVAILABLE, 503), () => jsonResponse(assessment())];
    const fetchMock = assistantApi(() => answers.shift()!());
    const user = renderApp();
    await askWithExample(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("busy or not available");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Appears not covered")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(thread().getAllByText(EXAMPLE_CLAIM)).toHaveLength(1);
    expect(callsTo(fetchMock, HTTP_METHOD.POST, API_PATH.analyze)).toHaveLength(2);
  });

  it("asks for a plain-words description when a message is blocked, without echoing the server's text", async () => {
    assistantApi(() => errorResponse(ERROR_CODE.GUARDRAIL_BLOCKED, 422, { detail: "Prompt-injection pattern matched: ignore previous" }));
    const user = renderApp();
    await askWithExample(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This message can't be processed. Please describe your claim in plain words.");
    expect(alert).not.toHaveTextContent(/injection/i);
  });

  it("renders a FastAPI validation list sensibly", async () => {
    assistantApi(() => jsonResponse({ detail: [{ loc: ["body", "claim"], msg: "String should have at most 4000 characters", type: "string_too_long" }] }, 422));
    const user = renderApp();
    await askWithExample(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("String should have at most 4000 characters");
  });

  it("says so when the contracts cannot be loaded, and lets the user try again", async () => {
    let failing = true;
    mockApi({
      ...defaultRoutes(),
      [routeKey(HTTP_METHOD.GET, API_PATH.contracts)]: () => (failing ? errorResponse(ERROR_CODE.UNAVAILABLE, 503) : jsonResponse(contracts)),
    });
    const user = renderApp();

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the contracts");
    failing = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: EXAMPLE_BUTTON })).toBeInTheDocument();
  });

  it("says so when there are no contracts", async () => {
    mockApi({ ...defaultRoutes(), [routeKey(HTTP_METHOD.GET, API_PATH.contracts)]: () => jsonResponse([]) });
    renderApp();
    expect(await screen.findByText("No contracts are available yet.")).toBeInTheDocument();
  });
});

describe("Assistant: AI credentials", () => {
  it("asks for settings, links to them and disables sending when there are no credentials; typing and examples still work", async () => {
    const fetchMock = assistantApi(() => jsonResponse(reply()), { [SESSION]: () => jsonResponse(noSession) });
    const user = renderApp();

    expect(await screen.findByText("Add your Azure OpenAI settings to start")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open settings" })).toHaveAttribute("href", "#/settings");
    expect(sendButton()).toBeDisabled();

    await user.click(screen.getByRole("button", { name: EXAMPLE_BUTTON }));
    expect(screen.getByLabelText(BOX)).toHaveValue(EXAMPLE_CLAIM);
    expect(sendButton()).toBeDisabled();
    await user.type(screen.getByLabelText(BOX), "{Enter}");
    expect(callsTo(fetchMock, HTTP_METHOD.POST, API_PATH.analyze)).toHaveLength(0);
  });

  it("says the server has no AI configured, with no link, when personal credentials are not allowed", async () => {
    assistantApi(() => jsonResponse(reply()), { [SESSION]: () => jsonResponse(noSessionAndNoByo) });
    renderApp();

    expect(await screen.findByText("This server has no AI configured")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open settings" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(BOX)).toBeInTheDocument();
  });

  it("shows no prompt when credentials are in place", async () => {
    assistantApi(() => jsonResponse(reply()));
    const user = renderApp();
    await user.click(await screen.findByRole("button", { name: EXAMPLE_BUTTON }));
    expect(screen.queryByText("Add your Azure OpenAI settings to start")).not.toBeInTheDocument();
    expect(sendButton()).toBeEnabled();
  });

  it("shows the settings prompt, not an error, when the server answers credentials_required: the message goes back to the box and the session is refreshed", async () => {
    let sessionCalls = 0;
    const fetchMock = assistantApi(() => errorResponse(ERROR_CODE.CREDENTIALS_REQUIRED, 428), {
      [SESSION]: () => jsonResponse(++sessionCalls === 1 ? serverSession : noSession),
    });
    const user = renderApp();
    await askWithExample(user);

    expect(await screen.findByText("Add your Azure OpenAI settings to start")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open settings" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    expect(screen.getByLabelText(BOX)).toHaveValue(EXAMPLE_CLAIM);
    await waitFor(() => expect(callsTo(fetchMock, HTTP_METHOD.GET, API_PATH.session).length).toBeGreaterThanOrEqual(2));
    await waitFor(() => expect(sendButton()).toBeDisabled());
  });
});

describe("Header connection badge", () => {
  it("shows the host while connected and links to settings", async () => {
    assistantApi(() => jsonResponse(reply()));
    renderApp();
    const link = await screen.findByRole("link", { name: "Connected: foyer.openai.azure.com" });
    expect(link).toHaveAttribute("href", "#/settings");
  });

  it("says 'Not connected' when there are no credentials", async () => {
    assistantApi(() => jsonResponse(reply()), { [SESSION]: () => jsonResponse(noSession) });
    renderApp();
    expect(await screen.findByRole("link", { name: "Not connected" })).toHaveAttribute("href", "#/settings");
  });

  it("is simply absent when the status cannot be read", async () => {
    assistantApi(() => jsonResponse(reply()), { [SESSION]: () => errorResponse(ERROR_CODE.UNAVAILABLE, 503) });
    renderApp();
    await screen.findByRole("button", { name: EXAMPLE_BUTTON });
    expect(screen.queryByRole("link", { name: /connected/i })).not.toBeInTheDocument();
  });
});

describe("Language", () => {
  it("switches the whole interface to French, persists it and uses it for the next request", async () => {
    const fetchMock = assistantApi(() => jsonResponse(assessment("fr")));
    const user = renderApp();
    await screen.findByRole("button", { name: EXAMPLE_BUTTON });

    await user.click(screen.getByRole("button", { name: "FR" }));

    expect(screen.getByRole("heading", { name: "Votre sinistre est-il couvert ?" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("fr");
    expect(localStorage.getItem("lang")).toBe("fr");

    await user.click(screen.getByRole("button", { name: "Vélo volé dans le local" }));
    expect(screen.getByLabelText(/que s'est-il passé/i)).toHaveValue(examples[0]!.claim.fr);
    await user.click(screen.getByRole("button", { name: "Vérifier la couverture" }));

    await screen.findByText("Semble non couvert");
    expect(callsTo(fetchMock, HTTP_METHOD.POST, API_PATH.analyze)[0]?.body).toMatchObject({ language: "fr" });
  });

  it("starts in the saved language", async () => {
    assistantApi(() => jsonResponse(reply()));
    renderApp({ route: ROUTE.ASSISTANT, language: "fr" });
    expect(await screen.findByRole("heading", { name: "Votre sinistre est-il couvert ?" })).toBeInTheDocument();
  });
});
