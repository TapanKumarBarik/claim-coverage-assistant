# Contributing

Thanks for helping. This project values small, readable, well-tested changes.

## Ground rules

- **Modular and SOLID.** Depend on the interfaces in `app/llm/port.py` and `app/guardrails/base.py`, not on
  concrete classes. New behaviour usually means a new class (a guard, a tool, a skill), not a longer function.
- **No magic strings.** Domain values are enums in `app/core/constants.py` (and typed constants in the UI).
- **DRY, KISS.** One place for each rule. If two modules need the same helper, it belongs in `core/`.
- **Errors are typed.** Raise an `AppError` subclass (`app/core/errors.py`); never return an ad-hoc status.
- **Security-sensitive code needs a test.** See the table in [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).
- **Never commit secrets, real keys, customer data or third-party policy PDFs.** CI runs `gitleaks`.

## Adding things

| You want to add | Do this |
| --- | --- |
| A tool the analyst can call | Subclass `Tool` in `app/agents/tools.py`, register it in `app/bootstrap.py`, allow it in the skill's `tools`. |
| A skill (prompt + output schema + tier) | New module in `app/agents/skills/`, add to `SkillSet`. Bump its `VERSION` when the prompt changes. |
| An input or output guard | Implement the `InputGuard` protocol (or extend `OutputGuard`), expose an `info`, add it in `bootstrap.py`. |
| A language | Add it to `Language`, the backend `_MESSAGES` table and the typed UI message catalogue. |
| An API change | Change the route, run `python -m app.cli openapi`, then `npm run gen:api` in `frontend/`. CI fails if either is stale. |

## Checks (all must pass)

```bash
cd backend && ruff check app tests evals scripts && ruff format --check app tests evals scripts \
  && mypy app evals && pytest
cd frontend && npm run typecheck && npm test && npm run build
```

`python -m evals.run_eval` runs the behavioural regression cases against a real model; run it when you change
prompts or guardrails and include the result in the pull request.

## Pull requests

Keep them focused, explain *why*, and note anything you could not verify. Be kind in review.
