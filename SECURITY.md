# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Use GitHub's private reporting: **Security → Report a vulnerability** on this repository. Include what you
found, how to reproduce it, and the impact you expect. You will get an acknowledgement within a few days,
and a fix or a clear explanation as soon as practical. Please give us a reasonable chance to fix the issue
before disclosing it.

If you run a public instance and believe it is being abused, rotate your credentials first
(see *Operator checklist*), then report.

## Scope

In scope: the code in this repository and its default configuration. Out of scope: Azure itself, third-party
documents the app downloads for the demo, and issues that need an attacker who already controls the server.

## How the app handles sensitive things (summary)

The full analysis is in [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md). The headlines:

| Asset | Handling |
| --- | --- |
| A visitor's Azure OpenAI key | Entered once on the Settings page, verified with a probe call, then held **only in server memory** behind an `HttpOnly`, `SameSite=Strict` (and `Secure` in production) cookie. Never written to disk, never logged, never returned to the browser, forgotten after an idle timeout or on request. |
| Endpoint supplied by a visitor | Strict allowlist (`https://<name>.openai.azure.com` and sibling Azure suffixes), no IP literals, ports, paths or credentials, redirects disabled, and checked **before** any outbound request (SSRF guard). |
| Operator secrets | Never in the repo. Admin access is configured as a **SHA-256 hash** of the admin password, supplied through the environment / Key Vault. Azure OpenAI can use managed identity, so no key is needed at all. Logs are scrubbed of configured secrets and bearer tokens. |
| Admin sign-in | The password is sent once over HTTPS and never kept in the browser. The server answers with a random 256-bit session id in an `HttpOnly`, `SameSite=Strict` cookie scoped to `/api/admin`, expiring when idle (30 min) or after 8 hours, and ended on sign-out. Changes made with the cookie must carry a same-site `Origin`. Guessing is throttled. |
| Claim text | Personal data (e-mail, IBAN, card, phone) is masked before any model call. The text is **never logged**; the governance log keeps only outcomes, counts and pseudonymous client ids. |
| Conversations | So admins can review answer quality, each answered question is **saved with that masking applied** (never the raw text), together with the answer and the visitor's like / dislike and optional comment (also masked). Free text can still contain personal data the masking cannot recognise (names, addresses), so the chat tells visitors that conversations are saved, they are removed after `CONVERSATION_RETENTION_DAYS` (30) or beyond `CONVERSATION_MAX_RECORDS` (2000), and an admin can delete one at any time (audited). Only an admin can read them; a visitor can rate only the answers their own browser received. Blocked attempts are not saved here. |
| Model behaviour | Input patterns + small-model classifier + fenced untrusted input + output sanitising + prompt-leak canary + citation verification. Tools are read-only. |

## Operator checklist (before you expose an instance)

1. **Do not set server-side Azure OpenAI credentials on a public instance** unless you accept paying for
   anyone's usage. Leave them empty and let visitors bring their own key (the default).
2. Generate the admin password with `python -m app.cli admin-token`, store **only the hash**
   (`ADMIN_TOKEN_SHA256`) in Key Vault / your secret store, and keep the password in a password manager.
3. Serve over HTTPS only (App Service does; set `APP_ENV=production` so cookies are `Secure` and HSTS is on).
4. Keep `ALLOW_BYO_CREDENTIALS` at its default unless you want the instance to be private.
5. Leave `/api/docs` off (it is disabled in production) and do not set `CORS_ORIGINS` unless you need it.
6. Turn on Dependabot, secret scanning and CodeQL for your fork; CI already runs `gitleaks`, `pip-audit` and
   `npm audit`.
7. If a key is ever exposed (logs, screenshots, chat): **rotate it in Azure first**, then investigate.

## Known limits

- Single-instance design: sessions, rate limits and the lockout list live in process memory. Running several
  instances needs a shared store (for example Redis) first.
- Admin authentication is one shared password (hashed, throttled, audited), turned into a server-side session.
  Scripts may send it as a bearer token instead. For real deployments put Microsoft Entra ID in front and
  record the signed-in user.
- Conversations are stored in a SQLite file under `STORAGE_DIR`: single instance, and only as private as the
  disk. Decide on a retention period you can defend before you run a public instance, and tell your visitors.
- Prompt injection cannot be solved by filtering; the design limits the blast radius instead (read-only
  tools, verified citations, no actions, no secrets in prompts).
