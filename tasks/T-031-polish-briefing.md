---
id: T-031
title: Polish the briefing (less detail, same UX)
status: review
owner: Devin (https://app.devin.ai/sessions/6dd08fcd621d471794063f556db90420)
branch: feat/t-031-polish-briefing
pr:
depends_on: []
touches: [components/workspace/BriefingView.tsx, components/workspace/ItemRow.tsx, components/workspace/SourceTags.tsx, app/globals.css]
---

## Goal

The briefing reads as too detailed. Keep the current layout and interactions (sections, label column,
source links, info buttons, contradictions, expand/collapse) and only polish it: quieter source links,
lighter labels and status marks, flatter sections, shorter footer. Fresh styling, not a reuse of
T-026/T-028/T-030.

## Acceptance criteria

- [ ] Same structure and interactions as before; every answer still visible with a source link
- [ ] Visibly less visual noise in the briefing (and chat answers, which share `ItemRow`)
- [ ] `bun run lint`, `bun run typecheck`, `bun run test` pass

## Log

- 2026-10-30, Devin: claimed.
- 2026-10-30, Devin: branch pushed (compact citations, status dots, flat sections, one-line footer); waiting for mirraman's review.
