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

Demo users (no password in this prototype): `anaesthesia`, `surgeon`, `gp`, `ed`, `pharmacist`, `oncologist`, `nurse`, `radiologist`. Each role comes with three example situations (`lib/catalog/situations.ts`), plus the hackathon's five cases. With the situation set to "None" there is no briefing, only the question bar and the contradictions. The question bar stays pinned to the bottom of the window (press `/` to focus it) and suggests questions for the current situation.

Optional: pre-compute contradictions and translations, so the first page view is instant.

```bash
bun run index
```

## Configuration

| Variable | Purpose |
|---|---|
| `LLM_PROVIDER` | `bob` (IBM Bob inference API), `openai-compatible`, or `mock` (no model: keyword retrieval) |
| `BOB_BASE_URL`, `BOB_API_KEY`, `BOB_MODEL` | Bob endpoint (OpenAI-style `…/chat/completions`), key and model |
| `BOB_TEAM_ID`, `BOB_INSTANCE_ID` | Sent as `x-team-id` / `x-instance-id` headers when set |
| `BOB_FAST_MODEL` | Optional faster model for planning and translation |
| `BOB_EXTRA_HEADERS` | Optional JSON object of extra headers |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | Any other OpenAI-compatible endpoint, including Gemini's compatibility API |
| `LLM_CONTRADICTION_SCAN` | `on` enables the optional extra AI scan; default `off` preserves free quota. Rule-based checks always run |
| `DATABASE_URL` | SQLite file (default `./medihacker.db`) |
| `PATIENT_DATA_DIR` | Patient folders (default `./data/data`) |
| `SESSION_SECRET` | Signs the session cookie |

Check the model connection first:

```bash
bun run llm:smoke
```

For Gemini's free tier, use `LLM_PROVIDER=openai-compatible`, `LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai`, and a model available to your project (for example `gemini-2.5-flash`). Put your AI Studio key in `LLM_API_KEY`. Opening a patient or source document makes no model requests by default. A briefing uses one request, a question uses one request, and translation runs only when the source panel's toggle is enabled, for highlighted passages only. Valid responses are cached and identical concurrent requests share one model call. Quota errors appear in the UI; exhausted daily quota still requires waiting for a reset or using another available provider. Gemini 2.5 Flash requests disable hidden reasoning so it does not consume the JSON output budget.

Gemini chat uses an enforced JSON schema for consistent citation fields. Older single-passage citation variants are normalized before the same source verifier runs; normalization never supplies missing quotes or bypasses checks. Chat has a larger output budget for questions that list multiple conditions. Free-tier quotas apply per project and model, so replacing a key in the same project does not restore exhausted quota. `gemini-2.5-flash-lite` is another compatible option when available to the project.

## Architecture

```
Browser (Next.js App Router + Carbon)                 Server (Next.js route handlers, Node)
┌───────────────────────────────────────┐            ┌──────────────────────────────────────────────┐
│ Login → Patients → Workspace          │  NDJSON    │ /api/briefing                                │
│  • Patient banner (age, CAVE)         │◀───stream──│  1 plan: role profile + situation templates  │
│  • Situation ComboBox / New situation │            │  2 extract: one LLM call for all sections     │
│  • Briefing (sections, facts, tags)   │            │  3 verify: quotes, numbers, calculations     │
│  • Contradictions rail                │            │  4 attach contradictions, stream sections    │
│  • Source panel (highlighted passage) │◀──JSON─────│ /api/documents  /api/chat  /api/situations   │
│  • Chat (same rules as the briefing)  │            │ /api/conversations  /api/login  /api/audit   │
└───────────────────────────────────────┘            └───────────────┬──────────────────────────────┘
                                                                     │
          data/data/patient-*/documents/*.json ──▶ parse + segment ──┤──▶ SQLite (Drizzle): users, situations,
                                                    into passages    │    conversations, messages, audit_log,
                                                                     │    contradictions, translations, llm_cache
                                                                     └──▶ LLM provider (IBM Bob / OpenAI-compatible)
```

### Components

| Component | Where | What it does |
|---|---|---|
| Document parser | `lib/data/parse.ts`, `lib/data/passages.ts` | Decodes `<BR>` and entities, then splits each German document into **passages** with stable ids (`docId:pNNN`) and exact character offsets: headings, single lines (vitals, diagnosis list items, medication table rows) and sentences of prose. The passage is the unit of citation and highlighting. |
| Role and situation catalogue | `lib/catalog/roles.ts` | Hard-coded **kinds** of facts per role and situation. A briefing combines the user's role, a role named in the situation, and the situation text. The extraction response can add up to four situation-specific questions without a separate planning request. No patient facts are hard-coded. |
| Briefing pipeline | `lib/briefing/pipeline.ts` | Builds the plan and sends all source passages once in a single extraction call for the complete briefing. Verifies and streams the resulting sections. Age is calculated in code from the date of birth. |
| Verifier (trust layer) | `lib/briefing/verify.ts`, `lib/briefing/items.ts` | Every fact must cite passages and quote them **verbatim** (normalised for whitespace and decimal commas); every number in the statement must appear in a cited passage or its document date; calculated values (weight change, BMI) are **recomputed in code**. Anything else is dropped and logged, never shown. Items the model could not answer are shown as "not verified" rather than silently missing. |
| Contradictions | `lib/contradictions/rules.ts`, `lib/contradictions/store.ts` | Deterministic rules for BMI vs. height/weight in the same document, two dates for the same admission/discharge, impossible dates, a finding reported on both sides, and one case number used for different stays. Optionally an LLM scan with a second "skeptic" pass that removes changes over time and measurement noise. Results are stored per patient in SQLite and shown immediately. |
| Chat | `lib/chat/answer.ts`, `app/api/chat` | Free-text questions with the same rules and verifier, scoped to the conversation's situation, history kept in SQLite. |
| LLM provider | `lib/llm/provider.ts`, `lib/llm/prompts.ts`, `lib/llm/cache.ts` | OpenAI-compatible adapter used for IBM Bob (team/instance headers), a mock for tests, response cache keyed by prompt and prompt version. Without a model the briefing falls back to keyword retrieval of German passages (clearly labelled). |
| Translations | `lib/data/translations.ts` | The source panel's "English translation" toggle requests only missing highlighted passages, in small batches. Saved translations are reused. The explicit indexing script can still pre-compute all translations. |
| UI | `app/`, `components/` | Carbon Design System (white theme, optional dark theme), IBM Plex. Login, patient list, workspace with patient banner, context bar, briefing, contradictions rail, source side panel and chat. |
| Auth and audit | `lib/auth/session.ts`, `proxy.ts`, `lib/repo.ts` | Username-only login with a signed cookie (prototype). Logins, patient views, situation changes, briefings (with the passages shown), opened sources and questions are written to `audit_log`. |

### Models and services

* **IBM Bob inference API** (configured via `BOB_*`) for extraction, planning, chat, translation and the contradiction scan. Any OpenAI-compatible endpoint works through the same adapter.
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

See [`eval/results.md`](eval/results.md) once `bun run eval` has been run with the model configured.

## Known limitations

* The IBM Bob endpoint shape is assumed to be OpenAI-compatible; run `bun run llm:smoke` to confirm before a demo.
* Without a model the briefing shows keyword-matched German passages and chat is disabled.
* Login has no password (prototype). One synthetic patient is available, but the code handles any number of patient folders.
