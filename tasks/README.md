# Task board

Shared to-do list for everyone working on MediHacker in parallel (people and coding agents).
**Read this before starting any work.** The board lives on `main`; branches only carry code.

## Files

- One file per task: `tasks/T-<NNN>-<short-slug>.md`, made from [`_TEMPLATE.md`](./_TEMPLATE.md).
- The header block at the top of each file is the source of truth for its state.

| Field | Meaning |
|---|---|
| `status` | `open` → `claimed` → `in_progress` → `review` → `done` (or `blocked`) |
| `owner` | Who works on it (name, or agent + session link). Empty when `open` |
| `branch` | Git branch for the work, e.g. `feat/t-007-pdf-export` |
| `pr` | Pull request URL once opened |
| `depends_on` | Task IDs that must be `done` (or merged) first |
| `touches` | Files/folders you expect to change. Used to avoid merge conflicts |

## Workflow

1. **Pick.** `git pull` on `main`, then look for `status: open` tasks whose `depends_on` are done:
   `grep -l "^status: open" tasks/T-*.md`
2. **Check overlap.** Compare its `touches` with every task that is `claimed`/`in_progress`
   (`grep -A1 "^touches" tasks/T-*.md`). If they share files, pick another task or coordinate first.
3. **Claim on `main`, right away.** Set `status: claimed`, `owner`, `branch`; commit only that file
   (`tasks: claim T-NNN`) and push to `main`. If the push is rejected, `git pull --rebase`; if someone
   else claimed it in the meantime, pick another task.
4. **Work on your branch**, created from the latest `main`. Set `status: in_progress` when you start.
   Merge `main` into your branch regularly. Before opening a PR run `bun run lint`, `bun run typecheck`
   and `bun run test`.
5. **Hand off.** Open a PR, then on `main` set `status: review` and `pr: <url>`. Add notes for the
   reviewer in the task file's *Log* section.
6. **Finish.** After the PR is merged set `status: done`.

## Rules

- One task per owner at a time. Board changes (`tasks/`) go straight to `main` in their own small
  commits, never mixed with code. Code goes through branches and PRs.
- New work? Add a task: copy `_TEMPLATE.md` to the next free number, `status: open`.
- Found a blocker? Set `status: blocked` and say why in the *Log*.
- Never commit `data/` (IBM hackathon data) or `.env.local` (API keys).
