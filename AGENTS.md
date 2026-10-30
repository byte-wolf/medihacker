<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Coordinating parallel work

Several people and agents work on this repo at the same time. Before starting, read [`tasks/README.md`](tasks/README.md): pick or add a task in `tasks/`, claim it on `main`, and work on the branch named in the task file.

## Design skill

UI work can use the Impeccable skill in `.devin/skills/impeccable/` (https://impeccable.style): `/impeccable polish`, `audit`, `critique`, `distill`, `typeset`, ... Its scripts download a detector engine into `scripts/bin/` (gitignored). The folder is an unmodified upstream build; to update, copy `.devin/skills/impeccable` from github.com/pbakaus/impeccable again.

## Environment gotchas (read before running `next dev` or `bun run test`)

- **Use official Node, not Fedora's system node.** `better-sqlite3` segfaults under `/usr/bin/node-20` (`libnode.so.115` ABI mismatch — crashes in `napi_module_register_by_symbol` when the app first opens the DB). Symptom: `bun run dev` prints "Ready" then silently exits ~10–30 s later; `next start` dies with SIGSEGV. Fix: Node ≥ 22 installed with `n` (`N_PREFIX=$HOME/.local n lts`, currently v26.13.0 at `~/.local/bin/node`). `~/.local/bin` must precede `/usr/bin` in PATH — `.bashrc` already does this for interactive shells; non-login shells need it exported.
- **`experimental.agentUpgrade: false` in `next.config.ts` is deliberate.** This Next.js build detects coding agents and stops `next dev` once to push an upgrade nudge. Removing the flag reintroduces the one-shot kill in agent sessions.
- **Setup**: `cp .env.local.example .env.local`; `LLM_PROVIDER=mock` runs the app in keyword-retrieval mode with no API key. Patient data is expected at `data/data/` — `data` is a symlink to the `TRACK-1-clinical-documentation` checkout (gitignored, never commit patient data).

## Testing

- `bun run test` — vitest, unit + integration (`tests/unit`, `tests/integration`). All LLM calls go through `MockProvider`; DB tests use a temp SQLite file. Free and deterministic.
- `bun run test:live` — `tests/live` via `vitest.live.config.ts`, gated by `LLM_LIVE=1`. Hits the real provider from env: OpenRouter key, or a local OpenAI-compatible endpoint (e.g. Ollama via `LLM_PROVIDER=openai-compatible` + `LLM_BASE_URL`) for a free offline model. `tests/helpers/env.ts` loads `.env.local`.
- `bun run test:e2e` — Playwright against a production build on port 3100.
- Synthetic fixtures: `tests/fixtures/patients/` (TEST-0001/2/3) mirrors the hackathon patient format exactly; use it or `tests/helpers/synthetic.ts` — never touch `data/` in tests.
- Verification before PRs: `bun run lint`, `bun run typecheck`, `bun run test`.
