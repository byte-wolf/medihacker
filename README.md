# MediHacker

MediHacker is a clinical documentation assistant built for Track 1 of the hackathon. A clinician enters their **role** (e.g. "attending physician", "pharmacist") and **task** (e.g. "pre-op medication review") and receives a single, focused screen showing only the patient facts relevant to that role and task — each fact linked back to the exact passage in the source document it came from.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js](https://nextjs.org) (App Router, TypeScript) |
| UI | [Carbon Design System](https://carbondesignsystem.com) (`@carbon/react`) |
| Database | SQLite via [Drizzle ORM](https://orm.drizzle.team) (`better-sqlite3`) |
| AI backend | Configurable via environment variables (`AI_PROVIDER`, `AI_MODEL`) |
| Language | TypeScript (strict) |

---

## Getting Started

### 1. Clone the repository

```bash
git clone <repo-url>
cd medihacker
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in your AI provider credentials:

```env
DATABASE_URL=./medihacker.db   # path to the SQLite database file
AI_PROVIDER=openai             # e.g. openai | anthropic | watsonx
AI_API_KEY=sk-...              # your API key
AI_MODEL=gpt-4o                # model name/ID to use
```

### 3. Install dependencies

```bash
npm install
```

### 4. Initialise the database

```bash
npm run db:push
```

This creates `medihacker.db` at the project root (gitignored) and applies the Drizzle schema.

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
medihacker/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (Carbon Theme provider)
│   ├── page.tsx            # Welcome page — role + task entry
│   └── api/                # API routes (added in later tasks)
├── components/             # Shared Carbon-based UI components
├── lib/
│   ├── db/                 # Drizzle schema + singleton client
│   └── data/               # Helpers to read patient JSON files
├── data/                   # Patient JSON files — gitignored (hackathon rules)
├── drizzle.config.ts       # Drizzle ORM configuration
├── .env.local.example      # Environment variable template
└── .env.local              # Local secrets — never committed
```

> **Note:** The `data/` directory is gitignored. Patient JSON files must be placed there manually after cloning.

---

## Architecture

### Next.js App Router

All pages and API routes live under `app/`. The root layout wraps the entire application in Carbon's `<Theme theme="white">` provider, giving every page access to Carbon's design tokens.

### Carbon Design System

UI components are sourced exclusively from `@carbon/react`. Carbon's white theme is used throughout — it aligns with the clinical, high-contrast aesthetic required for medical tooling.

### SQLite + Drizzle ORM

A local SQLite database (`medihacker.db`) stores LLM response cache entries (`llm_cache` table). Caching prevents redundant API calls when the same role/task/patient combination is requested more than once during a session. The database path is configurable via `DATABASE_URL`.

### Configurable AI Backend

The AI provider, API key, and model are all driven by environment variables (`AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`). This allows the same codebase to be pointed at OpenAI, Anthropic, IBM watsonx, or any other provider without code changes.
