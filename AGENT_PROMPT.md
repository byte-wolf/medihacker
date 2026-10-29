# Build Brief for the Coding Agent: MediHacker (Track 1: Clinical Documentation)

You are building **MediHacker**, a clinical documentation assistant for a hackathon. A clinician logs in, picks a patient and a clinical situation, and gets **one screen with only the patient facts that their role and situation need**. Every fact links to the exact sentence or table row it came from. The screen also says when something is **"not documented"** and points out **contradictions** in the documents. Then the clinician can ask follow-up questions in free text.

Read this whole brief before you write any code. Where it conflicts with `README.md` or `project-setup-plan.md`, this brief wins. Where it conflicts with `data/README.md` (the hackathon rules), the hackathon rules win.

Our two top priorities, on top of the scoring metrics, are:

1. **Clinical trust.** A clinician must be able to check every statement in one click and must never see an invented fact.
2. **Good user experience.** The answer has to be fast, calm, and readable at a glance in a stressful situation, such as an emergency department at 02:00.

---

## 0. Before you start

- Read `AGENTS.md`. This is **Next.js 16.4** with breaking changes. Run `npm install`, then read the relevant guides in `node_modules/next/dist/docs/` before you write any routing, data-fetching, server action, or caching code. `next.config.ts` enables `cacheComponents` and `partialPrefetching`, so read up on those as well.
- Read `data/README.md`, `data/data/README.md`, `data/cases/situations.md` and `data/cases/expected.json`. Then read all eight documents in `data/data/patient-0000-0001/documents/`. They are short German clinical letters.
- Fix these known setup issues first:
  - `.gitignore` contains `*data`. That pattern also ignores `lib/data/` and any file that ends in "data". Change it to `/data/`. The hackathon `data/` folder must stay out of git, and it has its own nested `.git`.
  - `.env.local.example` is mentioned in the README but missing. Create it.
  - `app/globals.css` has Next.js boilerplate, including dark-mode overrides and an Arial font, that fights Carbon. Remove it and use Carbon tokens and IBM Plex.
- Work in small, verifiable steps. Commit after each milestone (Section 9), with conventional commit messages.

---

## 1. Stack (fixed)

| Layer | Choice |
|---|---|
| Framework | Next.js 16.4 App Router, TypeScript strict, React 19 |
| UI | Carbon Design System v11 (`@carbon/react`, `@carbon/icons-react`), white theme (`g100` optional for night mode, see 6.6) |
| DB | SQLite via Drizzle ORM + `better-sqlite3` (`DATABASE_URL`) |
| LLM | **IBM Bob inference API** behind a provider interface (see Section 4) |
| Tests | Vitest (unit/integration), Playwright (E2E) + `@axe-core/playwright` (accessibility), custom eval script (metrics) |

Use only Carbon components for UI. Don't add Tailwind or another component library.

---

## 2. Core user flow

```
Login (username only) → Patient selection → Workspace
                                             ├─ Situation ComboBox (default: "None")
                                             ├─ Briefing (auto-built when a situation is chosen)
                                             ├─ Contradictions panel
                                             ├─ Chat (free-text questions, scoped to the active situation)
                                             └─ Source side panel (highlighted passage)
```

### 2.1 Login
- Username field only, no password. This is a prototype; state it in a small note on the login page. Use a Carbon `ComboBox` with the seeded users plus free typing, or a `TextInput`.
- Each user has **exactly one role and one department**, stored in the DB. Seed the users in 2.5.
- Keep the session in an httpOnly cookie. Add a logout action in the Carbon `Header`. The header always shows the user name, role and department.

### 2.2 Patient selection
- List every patient folder found under `data/data/*/`. Today there is one, `patient-0000-0001`, Anna Musterfrau, born 15 Mar 1959. The code must not assume a single patient.
- Show name, date of birth, sex, number of documents, and the date of the latest document. Use a Carbon `DataTable` or tiles.
- Show age **as of the latest document** (57 on 15 Apr 2016), not "today". Label it: "Age 57 (at latest document, 15 Apr 2016)". Use this as-of logic everywhere: present-tense questions mean "as of the date of the latest document".

### 2.3 Situation selection
- The Carbon `ComboBox` defaults to **None**. Its options:
  - the situations saved for this user (the user's own and those created for their role),
  - the 5 preset situations from `data/cases/situations.md`, each assigned to the seeded user with the matching role,
  - **"+ New situation…"**, which opens a Carbon `Modal` with title and description (multi-line). Save it to the DB, linked to the user.
- A user has one role and can end up in several situations. **The briefing is built from the user's role and the selected situation together.**
  - Example: an anaesthetist in "Pre-operative anaesthesia check" gets the anaesthesia core set (age, antithrombotics, allergies, cardiac function, airway/OSA, diabetes medication, renal function) plus whatever the situation text adds (planned quadrantectomy + IORT on 16 May 2016).
  - If a situation mentions a different role than the user's ("You are the emergency physician…"), use both perspectives. Show which role and situation are active in a persistent context bar, e.g. "Perspective: Anaesthetist · Situation: Pre-op anaesthesia check".
- **The situation stays fixed for a conversation.** It only changes when the user picks another one in the ComboBox. Changing it starts a new conversation and keeps the old one in history. Ask for confirmation if the current chat has messages.
- With **None** selected, show a neutral patient header and chat only. Chat answers then use the role perspective alone.

### 2.4 Chat
- Free-text questions in English or German, answered in the UI language (English).
- Every answer follows the briefing rules: only facts from the documents, each with a source link, "not documented" when absent, and a contradiction flag when relevant. Answers are rendered as structured fact items, not loose prose.
- Store the conversation history in the DB per (user, patient, situation). Users can reopen past conversations from a list.

### 2.5 Seed data
Seed users for at least these roles, including roles that aren't in the 5 situations, since the jury tests new situations with other roles:

| username | role | department |
|---|---|---|
| `anaesthesia` | Anaesthetist | Anaesthesiology |
| `surgeon` | Breast surgeon | Surgery |
| `gp` | General practitioner | Primary care |
| `ed` | Emergency physician | Emergency department |
| `pharmacist` | Clinical pharmacist | Pharmacy |
| `oncologist` | Oncologist | Oncology |
| `nurse` | Ward nurse | Surgery ward |
| `radiologist` | Radiologist | Radiology |

Assign the 5 preset situations to the matching users. The GP gets situations 3 and 5.

---

## 3. The briefing screen (the core deliverable)

The jury enters a situation and checks whether the screen answers 3 hidden questions **without clicking** (scrolling is fine) and **within 10 seconds**. Design for that.

### 3.1 Layout (desktop first, 1440 × 900; must still work at 1280 px and on a tablet)
- **Patient banner** (sticky): name, DOB, age at latest document, sex, **allergy/CAVE badge** in red if documented, and "Documents: 8 · latest 15 Apr 2016".
- **Context bar**: active role and situation, plus a "Change situation" control.
- **Main column, the briefing.** Sections are ordered by clinical priority for the role and situation. Each section is a Carbon `Tile` with a heading. Each fact is one row:
  - **Statement** in English, short and scannable, key value in bold (e.g. "**Thrombo ASS 100 mg** (acetylsalicylic acid), 1-0-0").
  - **Date/currency**: when the fact was documented (e.g. "Discharge letter, 15 Apr 2016").
  - **Source link(s)**: one Carbon `Tag`/link per supporting passage (e.g. "Discharge letter 04/2016 ¶ Medication"). Clicking one opens the side panel.
  - **Flags**: "Contradiction" (warning tag, links to the contradiction), "Calculated" (for derived values, e.g. weight change, with its inputs linked), and "Changed over time" (e.g. Blopress 1-0-½ in 2015 → 1-0-1 in 2016, both linked).
- **"Not documented" items** are first-class. If the role or situation needs something the documents don't contain, show it in its section as a neutral grey row: "**Renal function (creatinine/eGFR): not documented** in any of the 8 documents." No link needed. Never leave a needed item silently missing.
- **Contradictions panel**: contradictions relevant to this role and situation are expanded at the top of the briefing or in a right rail. All other patient contradictions are in a collapsed accordion below. Each one lists **every** conflicting passage side by side with links.
- **Source side panel**: a Carbon side panel (or a split pane) opens on the right with the full German document, scrolled to the cited sentence or table row and highlighted. Above it: document title, type, date and department. Offer a toggle to show an English translation of the highlighted passage, labelled "machine translation". Keep the briefing visible, and don't navigate away.
- **Footer note**: "Generated from 8 source documents. Every statement links to its source. Verify before clinical decisions." Calm, not alarming.

### 3.2 What counts as a fact (hard rules, from the hackathon)
- Show only facts that are in the documents. Translations, generic drug names (Blopress → candesartan), and **calculated values** (weight change, BMI recomputation) are allowed. Calculated values are marked as such and link all their inputs.
- Medication schedules use morning-midday-evening, e.g. `1 0 1 0` → "1-0-1". Leave out the night column unless it's non-zero.
- "Present tense" means as of 15 Apr 2016, the latest document date. Prefer the newest source and say when a value is old (e.g. "Last EF 60%, **June 2015**, no later echo documented").
- The IBM JSON files (`diagnoses.json`, `medication.json`, `scores-*.json`, …) are **only an index or hint**. They can help find candidates, but every displayed fact must be grounded in a document passage. Where the JSON and the documents differ, the documents win. Never cite the JSON as a source.
- You may hard-code **which kinds of facts** a role or situation needs (a role → fact-category catalogue). You may **not** hard-code facts, passages, or contradictions for this patient in runtime code.

### 3.3 Example role catalogues (extend them; keep them in one typed config file)
- **Anaesthetist / pre-op**: age, weight/height/BMI, allergies (esp. drugs/contrast), anticoagulants/antiplatelets + dose, cardiac function (EF, ECG, rhythm), blood pressure control, diabetes + glucose-lowering drugs (metformin, GLP-1), OSA/airway, renal function, relevant comorbidities (SLE, GERD → aspiration risk), planned procedure + date.
- **Surgeon / tumour board**: histology, TNM, grade, receptor status, Ki-67, tumour size/location/side, axillary status, imaging (BI-RADS), board recommendation + date, antithrombotics, allergies.
- **GP / diabetes**: glucose-lowering drugs + doses, HbA1c + date, weight trend, BMI, BP, renal function, lipids/statin, complications (retinopathy).
- **Emergency physician**: prior similar events + cause, allergies (contrast!), anticoagulation, antihypertensives, contrast-relevant meds (metformin), renal function, known vascular findings (stenosis side).
- **GP / follow-ups**: recommendations at each discharge and whether a later document records that they happened.
- **Pharmacist**: full current medication list with doses and schedule, changes over time, interactions-relevant conditions, allergies, renal function.

When a new situation doesn't match any catalogue, the LLM picks relevant categories from the role + situation text. Combine them with the role's base catalogue.

---

## 4. AI architecture

### 4.1 Provider: IBM Bob inference API
- Build a small `LlmProvider` interface (`lib/llm/`) with `complete({system, messages, jsonSchema?, temperature})` and streaming support. Implement **`BobProvider`** first.
- Read config from env (document in `.env.local.example`):
  ```env
  DATABASE_URL=./medihacker.db
  LLM_PROVIDER=bob
  BOB_API_KEY=            # key with "Inference" scope (or "General" + team id)
  BOB_BASE_URL=           # Bob inference base URL
  BOB_TEAM_ID=            # sent as team-id header; required for inference with a "General" key
  BOB_INSTANCE_ID=        # if required by the API
  BOB_MODEL=              # model id
  ```
- **The exact Bob endpoint, auth scheme and header names are not confirmed.** Your first task in this area is a 20-line smoke script, `scripts/llm-smoke.ts`, that sends one chat request and prints latency and output. Find the right request shape against the real API (we expect an OpenAI-compatible `chat/completions` route plus an instance/team ID header) before you build on it. If you can't confirm it, stop and ask us. Don't guess silently.
- Keep a second adapter possible behind the same interface (e.g. watsonx.ai or Anthropic). Don't build it unless Bob is blocked.
- Temperature 0. Use JSON/structured output wherever possible.

### 4.2 Offline indexing (once per patient, cached in SQLite)
Run on first access to a patient, and via `npm run index`. Re-run when a document hash changes.

1. **Parse documents**: decode HTML entities, turn `<BR>` into line breaks, keep the original text.
2. **Segment into passages** with stable IDs (`docId:pNNN`). A passage is one sentence, or **one table row** (medication tables, vital-sign lines like "Gewicht: 78 kg"), or one diagnosis-list line. Store the char offsets into the original text, the section heading it belongs to (Diagnosen, Allergien, Entlassungsmedikation, Anamnese, …), and the document metadata.
3. **Translate** every passage to English once and cache it, for the side panel toggle and to help the LLM. Mark it as machine translation.
4. **Contradiction scan** (patient-wide, persisted; see 4.4).

### 4.3 Per-request briefing pipeline (target: under 10 s total, measured)
1. Build the fact-category list from the role catalogue, the situation text, and (for new situations) one fast LLM call. Cache this per situation.
2. **One grounded extraction call**: give the LLM the categories, the situation, the as-of date, and **all passages with their IDs** (the 8 documents are small and fit in context). The LLM returns JSON: for each category, a list of facts `{statement, value, date, passageIds[], quote, kind: "documented"|"calculated"|"not_documented", calcInputs?}`.
3. **Server-side verification (the trust layer; never skip it):**
   - Every `passageId` must exist.
   - Every `quote` must be found (normalized for whitespace and entities) inside one of the cited passages.
   - Every number in `statement`/`value` must appear in a cited passage or be a declared calculation whose inputs are cited and whose result you **recompute in code** (e.g. weight delta, BMI).
   - Facts that fail are **dropped and logged** (and shown in a dev-only debug panel). They are never shown to the clinician. If a required category ends up empty after verification, show "not documented" only if the LLM also said not documented; otherwise show "could not be verified, see sources" with a search link.
4. Attach relevant contradictions from the precomputed store, matched by shared passages or categories.
5. **Stream** the result: render the patient banner and skeleton sections immediately (Carbon `SkeletonText`), then fill sections as they arrive. Measure and log submit-to-complete time per request.
6. Cache the briefing per (patient, situation hash, role, prompt version) in `llm_cache`. **The 10 s target must hold without the cache**, because the jury uses new situations. Report both cold and warm times.

### 4.4 Contradiction detection (precomputed, persisted)
A contradiction is two or more passages that **cannot all be true**, such as two dates for the same event, a BMI that doesn't match height and weight in the same letter, or different sides for the same finding. These are **not** contradictions: small measurement differences, values that changed over time (weight 78 → 66 kg, Blopress dose change), and differences from the JSON files. False alarms cost points, so be conservative.

Combine two layers:
- **Deterministic checks in code**: BMI vs height/weight within the same document (tolerance ±0.5); admission/discharge dates vs the dates in the narrative and the other documents of the same stay; impossible dates (e.g. malformed years); left/right laterality of the same finding across and within documents; case/stay IDs that don't match the stay.
- **LLM pairwise review**: give the LLM passages grouped by topic (laterality, dates of events, vitals, diagnoses, medication, staging) and ask for pairs that cannot both be true, with a one-line explanation and severity. Then **verify** that each claimed passage exists, and run a second "skeptic" pass that rejects time-course changes and measurement noise.
- Persist them in a `contradictions` table: `{id, patientId, title, explanation, severity, categories[], passageIds[], detectedBy: "rule"|"llm", createdAt}`. Each must link **all** its passages.
- In the UI, explain each one in one plain-English sentence and show the conflicting passages side by side.

### 4.5 Prompting rules (put them in versioned files under `lib/llm/prompts/`)
- "Use only the passages provided. If the information is not present, return `not_documented`. Never infer, never use general medical knowledge to fill gaps." General knowledge may only be used to decide *relevance* and to *translate or name generics*.
- Always ask for passage IDs and verbatim German quotes.
- Give the as-of date and the rule "present tense = as of the latest document".
- Keep the clinician's English output concise: statement under 20 words, no hedging prose.

---

## 5. Data model (Drizzle, `lib/db/schema.ts`)
Keep `llm_cache` and add:
- `users` (id, username unique, displayName, role, department)
- `situations` (id, title, description, createdByUserId, role, isPreset, createdAt)
- `user_situations` (userId, situationId): which situations a user can pick
- `patients_index` (patientId, docHash, indexedAt, promptVersion)
- `passages` (id `docId:pNNN`, patientId, docId, section, text, translation, startOffset, endOffset)
- `contradictions` (as in 4.4)
- `conversations` (id, userId, patientId, situationId nullable, createdAt)
- `messages` (id, conversationId, role user/assistant, content JSON incl. facts + passageIds, latencyMs, createdAt)
- `audit_log` (id, userId, patientId, action: login/open_patient/select_situation/view_briefing/open_source/ask_question, details JSON, createdAt)

Add a seed script (`npm run db:seed`) that is idempotent.

---

## 6. UX and clinical-trust requirements

1. **Answer first.** The most decision-relevant facts sit at the top, in plain words, with the key value in bold. No paragraphs of prose.
2. **One click to the evidence.** Every fact row has a visible source tag. The side panel opens in under 300 ms with the exact passage highlighted.
3. **Explicit absence.** "Not documented" is shown, never hidden. Older data is labelled with its date ("last documented June 2015").
4. **Safety signals stand out**, using Carbon status colours consistently and **never colour alone** (always icon + text): allergy/CAVE badge in the banner, contradiction warnings inline on affected facts, anticoagulation highlighted for procedural roles.
5. **Provenance and honesty**: a small "AI-assisted, verified against source text" note; "Calculated" and "machine translation" labels; no confidence percentages you can't justify.
6. **Calm under stress**: high contrast, generous spacing, IBM Plex, readable at arm's length. Optionally a dark (`g100`) theme toggle for night shifts.
7. **Loading**: skeletons within 100 ms of submit, progressive section fill, no layout jump when sections arrive. On an LLM error, show a clear `InlineNotification` with retry, and never partial unverified facts.
8. **Keyboard and accessibility**: full keyboard use (ComboBox, chat, side panel with Esc to close), visible focus, WCAG 2.1 AA, zero serious axe violations.
9. **Copy tone**: clinical English, standard abbreviations (EF, BP, HbA1c, ICA), German original terms in the side panel.

---

## 7. Testing and quality (required; part of "done")

### 7.1 Automated
- **Unit (Vitest)**: HTML/`<BR>` parsing; passage segmentation (table rows and vitals lines become separate passages; offsets map back exactly); medication schedule formatting; quote/number verifier (accepts real quotes, rejects altered numbers); calculations (weight delta, BMI); every deterministic contradiction rule, with positive *and* negative cases (e.g. a weight change over time must **not** be flagged).
- **Integration (Vitest, mocked LLM)**: briefing pipeline end to end with recorded LLM responses (fixtures in `tests/fixtures/llm/`), including the case where the LLM invents a fact and the verifier drops it.
- **E2E (Playwright)**: login as `anaesthesia` → select patient → select preset situation 1 → briefing visible → the expected answers' key values are present **above the fold or by scrolling, without clicks** → click a source tag → side panel shows the highlighted passage containing that value → ask a chat question → cited answer → change situation → new conversation. Also: create a new situation, None situation, logout. Run axe on every page.
- **Eval harness (`npm run eval`, runs against the real LLM)**: for each of the 5 situations, run the briefing as the matching seeded user and score the README metrics:
  - *Correct answers* (15): check that the key facts of `expected.json` appear on screen with a link to one of the expected source docs. Use deterministic key-value matching where possible and an LLM judge as a fallback. Report each question.
  - *Traceability*: share of displayed facts whose cited passage actually contains the fact.
  - *Invented facts*: facts not supported by any passage (target 0).
  - *Contradictions*: found vs a **test-only** reference list kept in `tests/fixtures/contradictions.reference.json`, reporting true positives and false alarms. This reference list is for evaluation only and must never be imported by runtime code; add a lint rule or test that enforces this.
  - *Load time*: cold and warm, slowest of 5 (target under 10 s cold).
  - Write the results to `eval/results.md` (and JSON). We'll put these numbers in the submission.
- Add an extra eval set of **at least 5 new situations with other roles** (pharmacist, oncologist, nurse, radiologist, …), with expected answers you derive from the documents, to guard against overfitting to the 5 cases.
- `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` must pass before every commit at a milestone.

### 7.2 Manual testing (do it; don't only rely on tests)
At each UI milestone, run the dev server and use the app in a real browser as each seeded user. Check visually at 1440 px and 1280 px, take screenshots, and fix what looks wrong: spacing, truncation, focus, empty states, error states (kill the LLM key and check the error UI), long new-situation text, and slow responses. Do a final manual run-through of all 5 situations plus 3 new ones, as the jury would, and write down what you observed in `eval/manual-test-notes.md`.

---

## 8. Non-goals
- Real authentication or passwords, multi-tenant security, production deployment.
- Editing the clinical documents.
- Patients other than those in `data/data/`. The code must handle N patients, though.
- Committing the `data/` folder or any IBM data. Test fixtures may contain **short** quotes needed for assertions only. Prefer reading from `data/` at test time and skip with a clear message if it's missing.

---

## 9. Milestones (commit after each; keep the app runnable)
1. Setup fixes (Section 0), env template, DB schema + seed, Bob smoke test working.
2. Document parsing + passage segmentation + translation cache + unit tests.
3. Login → patient selection → workspace shell with situation ComboBox (Carbon), audit log.
4. Briefing pipeline with verifier + streaming UI + source side panel + E2E for situation 1.
5. Contradiction detection (rules + LLM + skeptic) + panel + tests.
6. Chat with persisted conversations, situation locking.
7. Eval harness + extra situations; iterate on prompts and catalogues until the targets are hit (15/15, 100% traceability, 0 invented, ≥5 contradictions with 0 false alarms, under 10 s cold).
8. UX polish + accessibility pass + manual test notes.
9. README rewrite: architecture (components, data flow diagram, models/services used), how to run (incl. putting `data/` in place), metric results, known limitations.

## 10. Definition of done
- All 5 preset situations produce a screen that answers all 15 questions without clicks, each with a correct source link, in under 10 s cold.
- 0 invented facts, 100% traceability in the eval report.
- At least 5 real contradictions shown, each linking all its passages, with no false alarms on the reference list.
- New situations and other roles work end to end.
- Tests, lint, typecheck and build are green, and the README is complete.
- When you finish, summarise what works, what doesn't, and the measured metrics. Be honest; this goes into our demo video.
