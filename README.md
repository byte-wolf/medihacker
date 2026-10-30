# MediHacker

MediHacker is a clinical documentation assistant for Track 1 of the hackathon. A clinician logs in (their role and department come with the user name), picks a patient and a situation, and gets **one screen with only the facts that role and situation need**. Every fact links to the exact sentence or table row it came from, gaps say **"not documented"**, and **contradictions** in the documents are shown with all their passages. Free-text follow-up questions are answered in the same context, with the same rules.

## Quick start

Requirements: [Bun](https://bun.sh) (package manager and script runner) and Node.js ≥ 20.9 on your `PATH` (Next.js and `better-sqlite3` run on Node).

```bash
bun install
```

```bash
cp .env.local.example .env.local
```

Fill in the LLM settings in `.env.local` (see [Configuration](#configuration)). Without them the app still runs, in keyword-retrieval mode.

Put the hackathon data next to the code. It is **not** part of this repository and is gitignored:

```bash
git clone <hackathon-data-repo> data
```

The app expects `data/data/patient-*/…` (documents) and `data/cases/situations.md` (the five preset situations). Then start the app:

```bash
bun run dev
```

Open <http://localhost:3000>. The SQLite database (`medihacker.db`) is created, migrated and seeded on first use.

Demo users (no password in this prototype): `anaesthesia`, `surgeon`, `gp`, `ed`, `pharmacist`, `oncologist`, `nurse`, `radiologist`. Each role comes with three example situations (`lib/catalog/situations.ts`), plus the hackathon's five cases. With the situation set to "None" there is no briefing, only the question bar and the contradictions. The question bar stays pinned to the bottom of the window (press `/` to focus it; the handle on its top edge folds it to one line, remembered per browser) and suggests questions for the current situation.

Optional: pre-compute contradictions and translations, so the first page view is instant.

```bash
bun run index
```

## Configuration

| Variable | Purpose |
|---|---|
| `LLM_PROVIDER` | `openrouter`, `openai-compatible`, or `mock` (no model: keyword retrieval) |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | OpenRouter key and an ordered model list; the next model answers when one refuses, is rate-limited or answers badly |
| `OPENROUTER_FAST_MODEL`, `OPENROUTER_BASE_URL`, `OPENROUTER_REASONING_EFFORT` | Optional list for planning and translation; endpoint override; hidden reasoning effort (default `minimal`, faster and never cut off) |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | Any other OpenAI-compatible endpoint, e.g. a local Ollama server |
| `LLM_ITEMS_PER_CALL` | Briefing items per extraction call (1-8, default 2). Each call sends the whole record, so 4 roughly halves input tokens at some cost in speed; every call logs `[tokens] ...` and the briefing shows its total |
| `LLM_MAX_CONCURRENCY` | Max parallel LLM requests (default 12); the rest wait in a queue |
| `DATABASE_URL` | SQLite file (default `./medihacker.db`) |
| `PATIENT_DATA_DIR` | Patient folders (default `./data/data`) |
| `SESSION_SECRET` | Signs the session cookie |

Check the model connection first:

```bash
bun run llm:smoke
```

## Architecture

```
Browser (Next.js App Router + Carbon)                 Server (Next.js route handlers, Node)
┌───────────────────────────────────────┐            ┌──────────────────────────────────────────────┐
│ Login → Patients → Workspace          │  NDJSON    │ /api/briefing                                │
│  • Patient banner (age, CAVE)         │◀───stream──│  1 plan: role profile + situation templates  │
│  • Situation ComboBox / New situation │            │  2 extract: one LLM call per section, parallel│
│  • Briefing (sections, facts, tags)   │            │  3 verify: quotes, numbers, calculations     │
│  • Contradictions rail                │            │  4 attach contradictions, stream sections    │
│  • Source panel (highlighted passage) │◀──JSON─────│ /api/documents  /api/chat  /api/situations   │
│  • Chat (same rules as the briefing)  │            │ /api/conversations  /api/login  /api/audit   │
└───────────────────────────────────────┘            └───────────────┬──────────────────────────────┘
                                                                     │
          data/data/patient-*/documents/*.json ──▶ parse + segment ──┤──▶ SQLite (Drizzle): users, situations,
                                                    into passages    │    conversations, messages, audit_log,
                                                                     │    contradictions, translations, llm_cache
                                                                     └──▶ LLM provider (OpenRouter / OpenAI-compatible)
```

### Components

| Component | Where | What it does |
|---|---|---|
| Document parser | `lib/data/parse.ts`, `lib/data/passages.ts` | Decodes `<BR>` and entities, then splits each German document into **passages** with stable ids (`docId:pNNN`) and exact character offsets: headings, single lines (vitals, diagnosis list items, medication table rows) and sentences of prose. The passage is the unit of citation and highlighting. |
| Role and situation catalogue | `lib/catalog/roles.ts` | Hard-coded **kinds** of facts per role (anaesthetist, surgeon, GP, emergency physician, pharmacist, oncologist, nurse, radiologist) and per situation type (pre-op, tumour board, diabetes, emergency, contrast, follow-up, medication). A briefing combines the user's role, a role named in the situation, and the situation text. For new situations an LLM call adds up to four situation-specific questions. No patient facts are hard-coded. |
| Briefing pipeline | `lib/briefing/pipeline.ts` | Builds the plan, runs one extraction call per section **in parallel** (all passages of all documents are in the prompt), verifies and streams each section as soon as it is ready. Age is calculated in code from the date of birth. |
| Rule-based items | `lib/briefing/items.ts` | Age (from the date of birth) and the weight trend (every `Gewicht:` line with its date, plus the calculated change) are built in code, so they are complete and identical on every run. |
| Verifier (trust layer) | `lib/briefing/verify.ts`, `lib/briefing/items.ts` | Every fact must cite passages and quote them **verbatim** (normalised for whitespace and decimal commas); every number in the statement must appear in a cited passage or its document date; calculated values (weight change, BMI) are **recomputed in code**. Anything else is dropped and logged, never shown. Items the model could not answer are shown as "not verified" rather than silently missing. |
| Contradictions | `lib/contradictions/rules.ts`, `lib/contradictions/store.ts` | Deterministic rules for BMI vs. height/weight in the same document, two dates for the same admission/discharge, impossible dates, a finding reported on both sides, and one case number used for different stays. Optionally an LLM scan with a second "skeptic" pass that removes changes over time and measurement noise. Results are stored per patient in SQLite and shown immediately. |
| Chat | `lib/chat/answer.ts`, `app/api/chat` | Free-text questions with the same rules and verifier, scoped to the conversation's situation, history kept in SQLite. |
| LLM provider | `lib/llm/provider.ts`, `lib/llm/prompts.ts`, `lib/llm/cache.ts` | OpenAI-compatible adapter used for OpenRouter and any other compatible server (request queue, retries on rate limits, cut-off answers rejected), a mock for tests, response cache keyed by prompt and prompt version. Without a model the briefing falls back to keyword retrieval of German passages (clearly labelled). |
| Translations | `lib/data/translations.ts` | Passages are machine-translated once in the background for the source panel's "English translation" toggle. |
| UI | `app/`, `components/` | Carbon Design System (white theme, optional dark theme), IBM Plex. Login, patient list, workspace with patient banner, context bar, briefing, contradictions rail, source side panel and chat. |
| Auth and audit | `lib/auth/session.ts`, `proxy.ts`, `lib/repo.ts` | Username-only login with a signed cookie (prototype). Logins, patient views, situation changes, briefings (with the passages shown), opened sources and questions are written to `audit_log`. |

### Models and services

* **OpenRouter** (configured via `OPENROUTER_*`; `google/gemini-3.1-flash-lite` first, then `deepseek/deepseek-v4.1-flash-1017` and `anthropic/claude-haiku-5.5` as fallbacks) for extraction, planning, chat, translation and the contradiction scan. Any OpenAI-compatible endpoint, including a local model server, works through the same adapter. If the model fails (rate limit, outage), the affected sections fall back to keyword search with a notice.
* No other external services. The IBM JSON extraction files are not used: all facts come from the document text.

## Testing

```bash
bun run test        # unit + integration (Vitest), synthetic patient, mocked model
```

```bash
bun run test:e2e    # Playwright + axe accessibility checks, production build, no model
```

```bash
bun run eval        # metrics on the 5 official + 5 extra situations (needs the model and ./data)
```

* Unit tests cover parsing, segmentation and offsets, the verifier (invented quotes and numbers are rejected, calculations are recomputed), every contradiction rule including negative cases (weight change over time is not a contradiction), and the catalogue.
* An integration test runs the pipeline with a scripted model that also returns an invented fact, and checks that it is dropped.
* A boundary test makes sure runtime code never reads `expected.json` or the evaluation reference.
* The tests use a small synthetic patient written for this repository (`tests/helpers/synthetic.ts`), so no hackathon data is committed.
* `bun run eval` writes `eval/results.md`. An LLM judge checks each official question against `data/cases/expected.json` and the linked source document, checks every displayed fact against its cited passage, matches contradictions against `eval/contradictions.reference.json`, and measures cold load times.

## Metric results

Measured on 2026-10-30 with `bun run eval` (5 official situations). Briefing model: `google/gemini-3.1-flash-lite` via OpenRouter (fallbacks `deepseek/deepseek-v4.1-flash-1017`, `anthropic/claude-haiku-5.5`). Judge: `anthropic/claude-haiku-5.5`, a different model from the one that wrote the briefing, given each cited passage with its document date.

| Metric | Result | Target |
|---|---|---|
| Correct answers | 15 / 15 | 15 / 15 |
| Traceability (judge: cited passage supports the fact) | 97.5% of 160 facts | 100% |
| Facts the judge did not consider supported | 4 | 0 |
| Contradictions (known found − false alarms) | 5 − 0 | ≥ 5 |
| Load time, slowest of the 5, cold (no cache) | 4.5 s | < 10 s |

The 4 flagged facts are combinations or inferences rather than invented values: two diagnoses merged into one fact while citing one passage, a tumour diagnosis stated with a date taken from the letter rather than the quoted line, and one "no neoadjuvant chemotherapy" inference. Every number on screen is checked in code against its source; the judge's check is about wording.

Results vary slightly between runs because the model is not fully deterministic (earlier runs: 14–15 of 15). The full per-question report is written to `eval/results.md` (kept out of git because it quotes the hackathon's questions and expected answers). `bun run bench` compares the allowed OpenRouter models on real prompts (speed, valid JSON, verified facts).

## Known limitations

* The OpenRouter key enforces zero data retention, which excludes some providers; a model can then refuse a request, and the next model in `OPENROUTER_MODEL` answers. Run `bun run llm:smoke` before a demo.
* The briefing model is small and fast; it occasionally merges facts or infers. The verifier blocks invented numbers and quotes, not wording.
* Without a model the briefing shows keyword-matched German passages and chat is disabled.
* Login has no password (prototype). One synthetic patient is available, but the code handles any number of patient folders.
