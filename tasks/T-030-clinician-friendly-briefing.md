---
id: T-030
title: Make the briefing quicker to read for clinicians
status: in_progress
owner: Devin (https://app.devin.ai/sessions/8229f74360564ff28bf9cc08a8bfe94b)
branch: feat/t-030-clinician-briefing
pr:
depends_on: []
touches: [components/workspace/BriefingView.tsx, components/workspace/ItemRow.tsx, components/workspace/SourceTags.tsx, lib/format.ts, app/globals.css]
---

## Goal

mirraman: the briefing is too detailed and should be more intuitive for a clinician. Built on current `main`
(T-029's branch is based on the reverted T-026/T-028 code, so it is not reused).

## Acceptance criteria

- [ ] Answers read first: sources are a quiet link in a right-hand column, one per fact (latest document), "+N" for the rest.
- [ ] No check icon on every row; label hints like "(echo, ECG, rhythm)" and "why this matters" buttons don't compete with the answer.
- [ ] "Not documented" rows are one short muted line (reason in tooltip).
- [ ] Footer is one short line.
- [ ] Every answer still visible without a click, with at least one source link (eval rule).

## Log

- 2026-10-30, Devin: claimed.
