# Claim Coverage Assistant

Answers **"is this home-insurance claim covered?"** against the policy documents of a chosen contract, in
**English or French**, with **verified citations** and honest uncertainty. It is also a reference for building a
governed AI application: small-model routing, a thinking-model analyst, tools, guardrails, retries, abuse
controls and an admin governance dashboard.

> Not affiliated with, or endorsed by, Foyer, AXA, Baloise or any insurer. It reads their *public* documents
> to demonstrate the technique. Answers are informational, never an insurance decision.

## Screenshots

Captured from the real running app and UI in Microsoft Edge. The model is **scripted** (no Azure call), so the
answers are deterministic; they still pass through the real guardrails, citation verifier and governance
recording. Regenerate with `python -m scripts.capture_screenshots` (see [scripts/](backend/scripts/)).

<table>
<tr>
<td width="50%"><img src="docs/screenshots/01-not-connected.png" alt="Assistant before connecting"><br><b>Nothing works until you connect</b><br>A chat window with example claims; with no credentials the message box asks for your Azure OpenAI settings first.</td>
<td width="50%"><img src="docs/screenshots/02-settings.png" alt="Settings page"><br><b>Bring your own key</b><br>Endpoint, key and deployment names. The key is masked, tested, then kept in server memory only.</td>
</tr>
<tr>
<td><img src="docs/screenshots/03-connected.png" alt="Connected"><br><b>Verified connection</b><br>The settings are probed with a real call before they are accepted.</td>
<td><img src="docs/screenshots/04-assessment.png" alt="Coverage assessment with like and dislike buttons"><br><b>A cited, honest answer</b><br>The verdict, computed confidence, verified quotes, the facts still needed, caveats, <b>when it was generated</b>, and a like / dislike at the end.</td>
</tr>
<tr>
<td><img src="docs/screenshots/05-evidence-highlight.png" alt="Evidence highlighted in the source passage"><br><b>Evidence you can check</b><br>Each quote is highlighted inside the full source passage.</td>
<td><img src="docs/screenshots/06-greeting-small-model.png" alt="Greeting answered by the small model"><br><b>"Hello" stays on the small model</b><br>The chat keeps every exchange; greetings never reach the thinking model.</td>
</tr>
<tr>
<td><img src="docs/screenshots/07-guardrail-blocked.png" alt="Prompt injection blocked"><br><b>Injection stopped before any model call</b><br>A generic message, a reference id, and a strike toward lock-out.</td>
<td><img src="docs/screenshots/08-french-unclear.png" alt="French interface with an unclear verdict"><br><b>French, and "unclear" when it is</b><br>A candle on a garden table: probably excluded, unless an optional cover was taken.</td>
</tr>
<tr>
<td><img src="docs/screenshots/09-chat-dark.png" alt="The chat in dark mode, in French"><br><b>Dark mode</b><br>Follows the system theme. A dislike opens an optional comment box.</td>
<td><img src="docs/screenshots/10-admin-login.png" alt="Administrator sign-in"><br><b>Admin sign-in</b><br>Nothing of the admin area is shown until the password is accepted; the session lives in an HttpOnly cookie.</td>
</tr>
<tr>
<td><img src="docs/screenshots/11-admin-conversations.png" alt="Admin conversations table"><br><b>Every conversation, with its feedback</b><br>When it was generated, the question, the verdict, liked / disliked / not rated, satisfaction, filters, search and paging.</td>
<td><img src="docs/screenshots/12-admin-conversation-detail.png" alt="One conversation in the admin area"><br><b>Open one</b><br>The question (personal data masked), the answer exactly as the visitor saw it, their comment, and a delete button.</td>
</tr>
<tr>
<td><img src="docs/screenshots/13-admin-catalog.png" alt="Admin catalogue"><br><b>Policy versions</b><br>Upload a draft, review what changed, activate from an effective date.</td>
<td><img src="docs/screenshots/14-admin-governance.png" alt="AI governance overview"><br><b>AI governance: is it healthy?</b><br>One status line says whether anything needs attention, then four headline figures, the token budget and how requests turned out. <i>Requests</i> and <i>Rules</i> sit one tab away.</td>
</tr>
<tr>
<td><img src="docs/screenshots/15-admin-requests.png" alt="One AI request opened in the governance log"><br><b>What happened to a request</b><br>One line per request; open one for its models, tokens, tools, citations and guardrails, or jump to its conversation.</td>
<td><img src="docs/screenshots/16-admin-governance-dark.png" alt="AI governance overview in dark mode"><br><b>Dark mode</b><br>The admin area follows the system theme too.</td>
</tr>
</table>

The footer of each answer shows `model scripted-thinking`; with your key it shows your deployment name.

## What it does

- **A chat, not a form.** One message box pinned to the bottom, with the contract and loss date beside it.
  Enter sends; every exchange stays in the thread until you start a new chat. Each message is answered on
  its own: the server keeps no conversation memory, so a follow-up has to restate its facts.
- **Bring your own Azure OpenAI key.** Nothing works until a visitor connects their own endpoint, key and
  deployment names on the **Settings** page. The key is verified, then held only in server memory. The host
  of a public demo pays nothing.
- **Two models, two jobs.** A small, cheap model is the front desk: it answers "hello" and off-topic chat and
  flags manipulation. Only real claims reach the thinking model, which reads the policy and cites clauses.
- **Citations you can trust.** Every quote is checked against the source text and removed if it is not there.
  A decisive verdict with no verified quote is downgraded to "unclear". Confidence is *computed* from the
  evidence (a product summary can never produce "high").
- **Policy versions with effective dates.** A claim is assessed against the wording in force on its loss date.
  Admins upload a new version as a draft, review the change summary, then activate it.
- **Rated by the people who read it.** Every answer ends with *Was this answer helpful?* (like / dislike, and an
  optional comment on a dislike) and shows when it was generated.
- **Reviewable.** Admins sign in, then see every conversation in a table with its feedback, filter and search it,
  open one to read exactly what the visitor saw, and delete it. Questions are saved **with personal data
  masked**, removed automatically after 30 days, and the chat says so.
- **Governed.** Every request is recorded (outcome, models, tokens, guard hits, citation rate) without the
  claim text. The admin dashboard shows usage, safety, quality and the exact rules in force.

A five-minute walkthrough for showing it to someone: [docs/DEMO.md](docs/DEMO.md).

## How a request flows

```mermaid
flowchart TD
    A[Browser] -->|claim + session cookie| B[Admission: lockout, rate limit, token budgets]
    B --> C[Input guards: normalise, redact PII, injection patterns]
    C --> D{Concierge<br/>small model}
    D -->|smalltalk / off-topic| R[Short reply]
    D -->|attack| X[Blocked + strike]
    D -->|claim| E[Evidence: whole contract, or scoped hybrid retrieval]
    E --> F[Coverage analyst<br/>thinking model + read-only tools]
    F --> G[Output guards: sanitise, prompt-leak canary, citation verification]
    G --> H[Assessment with verified evidence and computed confidence]
    R --> L[(Governance log)]
    X --> L
    H --> L
    R --> V[(Conversations<br/>masked question, answer, rating)]
    H --> V
```

## Architecture

Layers depend downwards; every arrow into `llm/` goes through an interface (`LLM`, `Embedder`), so the model
provider, the store and the limiter are replaceable. `bootstrap.py` is the only place that knows which concrete
class implements which interface.

| Package | Responsibility |
| --- | --- |
| `core/` | Settings, enums (`constants.py` — no magic strings), typed errors, retry, circuit breaker, rate limits, secrets, logging |
| `catalog/` | Contracts, documents, **versions**, parsing PDFs/Markdown into section-aware chunks, file-backed store |
| `llm/` | Provider-neutral chat types, the `LLM` port, Azure adapter, **resilience decorator** (retry + breaker + load shedding), factory |
| `credentials/` | Bring-your-own-key: SSRF-safe endpoint validation, in-memory sessions, cookie, connector, provider |
| `guardrails/` | Input guards, output guards, citation verification and confidence |
| `agents/` | **Skills** (prompt + schema + tier + tools), **tools** (read-only), the **harness** (step/time-bounded loop) |
| `retrieval/` | Scoped BM25 + embedding ranking, the policy view for a loss date, the evidence ledger (citation refs) |
| `governance/` | Event recorder, summary/policy reporting |
| `conversations/` | Saved exchanges (SQLite), ratings, retention, and what the admin reads back |
| `services/` | `AdmissionControl` and `ClaimService`, which orchestrates one request |
| `api/` | Thin routers, admin sessions, security headers, error handlers |

Skills shipped: `concierge` (small model), `query_rewrite` (small model), `coverage` (thinking model, with the
tools `list_sections`, `search_policy`, `read_section`). Add your own in `agents/skills/`; see
[CONTRIBUTING](CONTRIBUTING.md).

## Security

Designed to be safe to run in public. The short version:

- Visitor keys: server-memory only, `HttpOnly` + `SameSite=Strict` cookie, never returned, never logged,
  idle expiry. Endpoint **allowlist** (SSRF guard), redirects disabled, verified before use.
- Operator secrets: never in the repo. Admin access is a **SHA-256 hash**; Azure OpenAI can use **managed
  identity** (no key). Azure Key Vault references in the Bicep template. Logs redact secrets.
- Prompt injection: patterns + small-model classifier + fenced untrusted input + output sanitising + prompt-leak
  canary + citation verification. Tools are read-only; there are no actions to hijack.
- Abuse: per-IP rate limit, per-client and global **token budgets**, concurrency gate, lockout after repeated
  hostile messages, hard output and time limits.
- Personal data (e-mail, IBAN, card, phone) is masked before any model call and never logged. Saved
  conversations hold only the masked text, expire automatically, can be deleted by an admin, and are disclosed
  to visitors in the chat. Names and addresses are *not* recognised, so this is minimisation, not anonymisation.
- Admin: password hash only, server-side session in an `HttpOnly` `SameSite=Strict` cookie, idle and maximum
  expiry, same-site check on changes, throttled guessing.

Read [SECURITY.md](SECURITY.md) (reporting, operator checklist) and [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md)
(each threat → mitigation → the test that proves it).

## Run it locally

Everything below was run end to end on Windows (PowerShell). On macOS or Linux use `.venv/bin/python` where you
see `.\.venv\Scripts\python`.

**You need:** Python 3.12 or newer (3.13 is what CI and Azure use), Node.js 22.12 or newer (CI uses 24), and git.
An Azure OpenAI resource is needed only for *real* answers; the [demo server](#no-azure-account-the-demo-server)
below runs the whole app with a scripted model instead.

### 1. One-time setup

```powershell
# Backend
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements-dev.txt
.\.venv\Scripts\python scripts/fetch_sources.py   # optional: downloads the public PDFs (they are not committed)

# Frontend
cd ..\frontend
npm ci
```

Without the PDFs the app still starts and loads the clearly fictional contract. One publisher refuses automated
downloads; the script says which file to save by hand and does not try to get around the block.

### 2. Set an admin password (once)

The admin area is off until a password *hash* is configured:

```powershell
cd backend
.\.venv\Scripts\python -m app.cli admin-token     # prints a password and its hash
copy .env.example .env                            # .env is git-ignored
# in .env, uncomment ADMIN_TOKEN_SHA256 and paste the HASH (not the password)
```

Keep the password somewhere safe: it is shown once and only its hash is stored. The server reads `.env` when it
starts, so restart it after changing the file.

### 3. Start it (two terminals)

```powershell
# Terminal 1: backend, http://localhost:8000
cd backend
.\.venv\Scripts\python -m uvicorn app.main:create_app --factory --reload

# Terminal 2: frontend dev server, http://localhost:5173
cd frontend
npm run dev
```

**Open <http://localhost:5173>.** The dev server reloads the page as you edit and forwards every `/api` call to
the backend. Stop either server with `Ctrl+C`.

If something else already uses port 8000 (check with `Get-NetTCPConnection -LocalPort 8000 -State Listen`), run the
backend elsewhere and tell the dev server where it is:

```powershell
.\.venv\Scripts\python -m uvicorn app.main:create_app --factory --reload --port 8010
$env:API_PROXY_TARGET = "http://127.0.0.1:8010"; npm run dev      # bash: API_PROXY_TARGET=... npm run dev
```

You can also put `API_PROXY_TARGET=http://127.0.0.1:8010` in `frontend/.env.local` (git-ignored).

| What | Where |
| --- | --- |
| The app (use this one) | <http://localhost:5173> |
| Admin area | <http://localhost:5173/#/admin> |
| API, interactive docs (local only) | <http://localhost:8000/api/docs> |
| Liveness probe | <http://localhost:8000/api/healthz> |
| Backend alone, serving the *built* UI (the production shape) | <http://localhost:8000> after `cd frontend; npm run build` |

### 4. What to try

1. **Assistant.** The header says *Not connected*; the message box asks for your Azure OpenAI settings first.
2. **Settings.** Paste your endpoint (`https://<resource>.openai.azure.com`), key, and the *deployment names* of a
   thinking model and a small model (one deployment can serve both). The settings are tested with a real call and
   kept in server memory only; restarting the backend forgets them. Refusals are explicit: a non-Azure host
   (*Only Azure OpenAI hosts are accepted*), a malformed endpoint, or an unreachable resource
   (*Azure OpenAI is not reachable right now*) leave you *Not connected*.
3. **Chat.** Click an example or describe a claim. Try the fictional *Exemple Assurances* contract first: it has
   clause-level text, so you get real citations. Like or dislike the answer at the end.
4. **Admin.** Open **Admin** and sign in. *Contracts and documents* shows the four seeded contracts;
   *Conversations* fills as you chat; *AI governance* shows the Overview, each Requests row (with a *View
   conversation* link) and the Rules in force.
5. **Language.** `EN` / `FR` in the header switches the whole interface and the answers.

### No Azure account: the demo server

Runs the real application, guardrails and admin area with a *scripted* model that recognises four scenarios
(bike, candle, phone, pipe). It is repeatable and calls nothing external; say so when you show it.

```powershell
cd frontend; npm run build                 # once: the backend serves the built UI
cd ..\backend
.\.venv\Scripts\python -m scripts.demo_server --port 8091
```

Open <http://127.0.0.1:8091>. In **Settings** use any `https://demo.openai.azure.com`, any key of 8+ characters
and any two deployment names. Admin password: `demo-admin-password` (demo server only). Its data lives in a
temporary folder and disappears when you stop it. The walkthrough is in [docs/DEMO.md](docs/DEMO.md).

### Your data and how to reset it

The catalogue and versions, the governance log and saved conversations live in `backend/data/storage`
(`STORAGE_DIR`). To start clean: stop the backend, delete that folder, start again. The contracts are seeded on
the next start (the log line is `seeded_catalog`).

### If something does not work

| You see | Why | What to do |
| --- | --- | --- |
| `Address already in use` / `Errno 10048` | Another program owns the port | Use `--port` and `API_PROXY_TARGET` as above |
| The page loads but every request fails | The dev server cannot reach the backend | Start the backend; check `API_PROXY_TARGET` matches its port |
| *The admin area is not enabled on this deployment.* | `ADMIN_TOKEN_SHA256` is not set, or the backend was not restarted after editing `.env` | Set the hash (step 2) and restart the backend |
| *That password was not accepted.* | The hash was typed as the password, or a different password was used | Sign in with the *password*; run `admin-token` again for a new pair |
| *Too many attempts.* | Every sign-in attempt is counted, so guessing is slow | Wait a little and try again |
| *Cross-origin request refused.* | The backend saw a browser `Origin` that differs from the `Host` it received, usually a proxy that rewrites `Host` | Open the app at the dev server address. The bundled dev proxy already forwards the browser's `Host`; keep that if you add another proxy |
| Settings: *Azure OpenAI is not reachable right now* | Wrong host, no network, or a firewall | Check the endpoint (`https://<resource>.openai.azure.com`) and your connection |
| Connected, but answers fail with a credentials error | Wrong key, or a model name used instead of the *deployment name* | Re-enter them in Settings |
| `http://localhost:8000` shows a blank page or a notice | The UI has not been built; the backend serves `backend/app/static` | `cd frontend; npm run build`, or use port 5173 |

**Azure OpenAI.** Create two deployments in Azure AI Foundry and use their *deployment names*: a **thinking model**
for analysis and a **small model** for greetings and routing (one deployment can serve both). The key and
endpoint are on the resource's *Keys and Endpoint* page. Use a key you can rotate.

**Private deployment with server-side credentials** (your own use, evals): set the `AZURE_OPENAI_*` variables in
`backend/.env`, preferably with no key at all (`az login` locally, managed identity in Azure). Do **not** do this
on a public instance.

### Admin area (`/#/admin`)

Opening **Admin** shows only a sign-in page until the password from step 2 is accepted.

Tabs: **Contracts and documents** (upload → draft → review changes → activate/withdraw), **Conversations**
(every saved question and answer with its like / dislike, satisfaction, filters, search, delete),
**AI governance** (an *Overview* with a health status line, headline figures and the token budget; a *Requests*
log where each request opens to its details and its conversation; the *Rules* in force), **Audit log**.
Scripts can still call the admin API with `Authorization: Bearer <password>`.

## Configuration

Everything is an environment variable (see [`backend/.env.example`](backend/.env.example)). The ones that matter:

| Variable | Default | Meaning |
| --- | --- | --- |
| `ALLOW_BYO_CREDENTIALS` | `true` | Let visitors connect their own Azure OpenAI resource |
| `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_REASONING_DEPLOYMENT`, `AZURE_OPENAI_FAST_DEPLOYMENT` | empty | Optional operator-paid model access |
| `ADMIN_TOKEN_SHA256` | empty | Enables the admin area (SHA-256 hash of the admin password) |
| `ADMIN_SESSION_IDLE_TTL_S`, `ADMIN_SESSION_MAX_AGE_S` | `1800`, `28800` | When an admin is signed out |
| `CONVERSATION_RETENTION_DAYS`, `CONVERSATION_MAX_RECORDS` | `30`, `2000` | How long and how many saved conversations are kept |
| `ANALYZE_RATE_PER_MINUTE` | `6` | Per-client request rate |
| `CLIENT_DAILY_TOKEN_BUDGET` / `GLOBAL_DAILY_TOKEN_BUDGET` | `60000` / `1000000` | Token caps (global applies to operator-paid calls only) |
| `ABUSE_STRIKE_LIMIT`, `ABUSE_LOCKOUT_S` | `3`, `900` | Lockout after repeated hostile messages |
| `SESSION_IDLE_TTL_S` | `3600` | How long a visitor's key is kept after the last use |
| `STORAGE_DIR` | `backend/data/storage` | Catalogue, versions, governance log, conversations (use `/home/data/storage` on App Service) |

## Quality gates

```powershell
cd backend;  ruff check app tests evals scripts; mypy app evals; pytest      # 185 tests
cd frontend; npm run typecheck; npm test; npm run build                      # 209 tests; typecheck covers vite.config.ts too
cd backend;  python -m evals.run_eval                                         # behaviour cases, real model
```

- `docs/openapi.json` is the API contract. A test fails if the code drifts from it, and CI fails if the
  generated frontend types (`npm run gen:api`) are stale. Regenerate with `python -m app.cli openapi`.
- `evals/cases.yaml` encodes expected behaviour: right verdict and clause, humble on summary-only contracts,
  greetings stay on the small model, injection is blocked. Use `--repeat 3` to see non-determinism.
- CI also runs `gitleaks`, `pip-audit`, `npm audit` and CodeQL (`.github/workflows/security.yml`).

## Deploy to Azure (Free tier works)

```powershell
az group create -n rg-claims-demo -l westeurope
az deployment group create -g rg-claims-demo -f infra/main.bicep -p webAppName=<unique-name>
```

The template creates the App Service (Linux, Python 3.13), a **Key Vault** (RBAC) and a **managed identity** that
can read it. **No secret passes through the template.** Finish with:

```powershell
# 1. let yourself write secrets, then store the admin hash (never the token)
az role assignment create --role "Key Vault Secrets Officer" --assignee <your-object-id> --scope <vault-id>
az keyvault secret set --vault-name <vault> --name admin-token-sha256 --value <hash>
# 2. (only if you want operator-paid models) let the app call your Azure OpenAI resource without a key
az role assignment create --role "Cognitive Services OpenAI User" --assignee <appPrincipalId> --scope <openai-id>
az webapp restart -g rg-claims-demo -n <unique-name>
```

For a **public** instance, leave `azureOpenAiEndpoint` empty so visitors bring their own key. For GitHub Actions
deployment without stored secrets (OIDC), create an Entra app registration with a federated credential for
`repo:<owner>/<repo>:environment:production`, give it *Website Contributor* on the resource group, and set the
repository variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_WEBAPP_NAME`.

**Free F1 reality:** 60 CPU-minutes/day, 1 GB RAM, no always-on (first request after idle is slow), one instance,
no custom-domain TLS. Fine for a demo; use B1+ for anything real. Uploaded versions live in `/home/data`, which
survives restarts and redeploys.

## The public data, honestly

Full conditions of Luxembourg home policies are mostly not public: Foyer's require a customer and contract
number, and Baloise publishes them "on request". What *is* public are regulated product summaries (IPIDs) and
brochures, which list perils and exclusions but not the conditions that decide most real claims. So for real
contracts the assistant is deliberately cautious, says it relies on a summary, and asks for the missing facts.
To show clause-level reasoning there is **one clearly fictional contract** (`backend/data/synthetic/`), labelled
fictional in the UI and in every answer. With real general conditions, upload them in the admin area.

Third-party PDFs are fetched by `scripts/fetch_sources.py`, not committed. Servers that refuse automated
downloads are respected.

## Scope and limits

- Single instance by design: catalogue, sessions, rate limits and lockouts are in process / on disk. To scale
  out: catalogue → Postgres, files → Blob Storage, vectors → Azure AI Search, counters and sessions → Redis.
- Admin sign-in is one shared, hashed, throttled password (turned into a server-side session). Put Entra ID in
  front for real use.
- Conversations are single rows of *question -> answer*, not threads: the admin sees each exchange on its own.
  They live in a SQLite file, so this is single instance too; swap the store for a database to scale out.
- Feedback is self-reported and unauthenticated (one browser can rate only its own answers): use it to decide
  what to read, not as a quality metric.
- Scanned PDFs are rejected (no OCR).
- The chat has no memory between messages (see above). Follow-up questions are a deliberate non-goal for now.
- Not built yet: running the eval cases against a *draft* before activation, per-user admin accounts,
  Application Insights export, CSV export of conversations.

## License

[MIT](LICENSE). Contributions welcome: [CONTRIBUTING](CONTRIBUTING.md).
