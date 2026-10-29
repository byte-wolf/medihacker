# MediHacker — Project Setup Plan

## Overview

Build a clinical documentation app (Track 1) where a clinician enters their role and task and gets a single screen showing only the patient facts relevant to that role/task, each linked to its source document passage.

**Scope of this plan:** Bootstrap the base tech stack with a working Welcome page. No auth. No LLM integration yet. No patient data wiring yet.

**Confirmed decisions:**
- **Framework:** Next.js (App Router) with React
- **UI:** Carbon Design System (`@carbon/react`)
- **Database:** SQLite via Drizzle ORM (for LLM response caching in later tasks)
- **Auth:** Skipped — demo app
- **AI backend:** Undecided — will be an environment-variable-driven configuration
- **Language:** English UI; German source documents shown as-is
- **Linter/Formatter:** ESLint + Prettier (Next.js defaults)
- **TypeScript:** Yes

---

## Architecture Snapshot

```
medihacker/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (Carbon Theme provider)
│   ├── page.tsx            # Welcome page (role + task entry form)
│   └── api/                # API routes (added in later tasks)
├── components/             # Shared Carbon-based UI components
├── lib/
│   ├── db/                 # Drizzle schema + client
│   └── data/               # Helpers to read patient JSON files
├── data/                   # Patient JSON files (gitignored)
├── drizzle.config.ts       # Drizzle configuration
└── .env.local              # Secrets (AI key, DB path)
```

---

## Sub-Tasks

---

### Sub-Task 1 — Scaffold Next.js project with TypeScript and ESLint

**Status:** `[x] done`

**Intent:**
Create the Next.js application using `create-next-app` with TypeScript, ESLint, Tailwind disabled (Carbon provides styles), and the App Router. This gives us a clean, typed project base.

**Expected Outcomes:**
- `package.json` present with Next.js, React, TypeScript deps
- `tsconfig.json` configured for strict mode
- `app/layout.tsx` and `app/page.tsx` exist
- `npm run dev` starts without errors
- `npm run build` succeeds

**Todo List:**
1. Run `create-next-app` with flags: TypeScript yes, ESLint yes, Tailwind no, `src/` dir no, App Router yes, import alias `@/*`
2. Verify the dev server starts and the default page loads

**Relevant Context:**
- Workspace root: `c:\programing\medihacker`
- No existing `package.json` yet

---

### Sub-Task 2 — Install and configure Carbon Design System

**Status:** `[x] done`

**Intent:**
Add `@carbon/react` and its peer dependencies. Configure the Carbon theme (white theme is the medical standard) and set up the global CSS import so Carbon styles apply across all pages.

**Expected Outcomes:**
- `@carbon/react` importable in any component
- Carbon global styles loaded in `app/layout.tsx`
- Carbon `Theme` provider wrapping the app with the `white` theme
- No build errors or missing-peer-dep warnings

**Todo List:**
1. Install `@carbon/react`, `@carbon/icons-react`, and any required peer deps (`sass` for Carbon styles)
2. Add Carbon's global CSS reset/styles import to `app/layout.tsx`
3. Wrap children with `<Theme theme="white">` in `app/layout.tsx`
4. Configure `next.config.ts` to handle Carbon's `.scss` files if necessary (Carbon v11 ships CSS-in-JS, but confirm)
5. Smoke-test by importing a `Button` from `@carbon/react` in `app/page.tsx`

**Relevant Context:**
- Carbon Design System v11 (`@carbon/react` ≥ 1.x) uses CSS-in-JS by default — no Sass config needed unless using Carbon's Sass tokens directly
- Reference: https://carbondesignsystem.com/developing/frameworks/react

---

### Sub-Task 3 — Set up SQLite with Drizzle ORM

**Status:** `[x] done`

**Intent:**
Add Drizzle ORM with the `better-sqlite3` driver. Define an initial schema with a `llm_cache` table (keyed by a hash of the prompt) so future LLM calls can be cached without re-running expensive API calls.

**Expected Outcomes:**
- `drizzle.config.ts` present at project root
- `lib/db/schema.ts` defines `llm_cache` table
- `lib/db/index.ts` exports a singleton Drizzle client
- `npm run db:migrate` (or drizzle-kit push) applies the schema to `medihacker.db`
- No TypeScript errors

**Todo List:**
1. Install `drizzle-orm`, `better-sqlite3`, `drizzle-kit`, and `@types/better-sqlite3`
2. Create `lib/db/schema.ts` with `llm_cache` table: `id`, `prompt_hash` (text, unique), `response` (text), `created_at` (integer timestamp)
3. Create `lib/db/index.ts` with a singleton `BetterSqlite3Database` instance pointing at `./medihacker.db`
4. Create `drizzle.config.ts` referencing the schema and SQLite db file
5. Add `"db:push": "drizzle-kit push"` script to `package.json`
6. Run `npm run db:push` to create the database file and table
7. Add `medihacker.db` to `.gitignore`

**Relevant Context:**
- Drizzle + better-sqlite3 is the standard local SQLite setup: https://orm.drizzle.team/docs/get-started-sqlite
- DB file path should come from `.env.local` `DATABASE_URL=./medihacker.db` so it can be overridden

---

### Sub-Task 4 — Build the Welcome page

**Status:** `[x] done`

**Intent:**
Replace the default Next.js page with a proper Welcome page using Carbon components. The page should communicate the app's purpose clearly and include the entry point for the role+task form (the form itself is wired up in a later task — for now it can be a placeholder).

**Expected Outcomes:**
- `app/page.tsx` renders a Carbon-styled Welcome page
- Page includes: app title, a one-line description of purpose, a visible placeholder for the role/task input area
- Page passes `npm run build` with no errors
- No unused imports or TypeScript errors

**Todo List:**
1. Replace `app/page.tsx` content with a Carbon `Grid` / `Column` layout
2. Add a Carbon `Heading` with the app name ("MediHacker" or similar)
3. Add a short subtitle explaining the clinical use case
4. Add a Carbon `Tile` placeholder labeled "Enter your role and task to get started" (form to be wired in a later task)
5. Ensure the page is visually centred and looks clean at 1280 px viewport

**Relevant Context:**
- Use `@carbon/react` components: `Grid`, `Column`, `Heading`, `Tile`, `Button`
- Carbon layout grid: https://carbondesignsystem.com/elements/2x-grid/overview

---

### Sub-Task 5 — Environment variable setup and `.env.local` template

**Status:** `[x] done`

**Intent:**
Create a `.env.local.example` file documenting all environment variables the project will need (AI API key, DB path). This is a hackathon — documenting config early prevents confusion.

**Expected Outcomes:**
- `.env.local.example` at project root listing all variables with placeholder values and comments
- `.env.local` added to `.gitignore`
- `README.md` stub created explaining how to run the project locally

**Todo List:**
1. Create `.env.local.example` with: `DATABASE_URL`, `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`
2. Confirm `.env.local` is in `.gitignore` (Next.js adds this by default)
3. Create a `README.md` at project root with: project description, tech stack list, "Getting started" steps (clone, copy `.env.local.example`, `npm install`, `npm run db:push`, `npm run dev`), and a note that `data/` is gitignored

**Relevant Context:**
- `data/` is already gitignored per hackathon rules
- README is required for submission

---

## Open Questions / Deferred Decisions

| Topic | Decision |
|---|---|
| LLM provider | Leave as `AI_PROVIDER` env var; wire up in a later task |
| Document chunking / embedding strategy | Deferred — depends on chosen LLM |
| Multi-patient support | Out of scope for hackathon |
| Role/task hard-coding vs. free text | Free text input; roles can be inferred by the LLM |
| Contradiction detection strategy | Deferred — requires LLM integration task |
