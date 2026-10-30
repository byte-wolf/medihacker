---
id: T-026
title: Minimal briefing with AI-selected items
status: claimed
owner: Devin for mirraman (https://app.devin.ai/sessions/b5e677a322d14b239181836c7ede0378)
branch: feat/t-026-minimal-briefing
pr:
depends_on: []
touches: [lib/briefing/pipeline.ts, lib/catalog/roles.ts, lib/llm/prompts.ts, lib/briefing/items.ts, components/workspace/BriefingView.tsx, components/workspace/ItemRow.tsx, components/workspace/SourceTags.tsx, app/globals.css, tests/]
---

## Goal

The briefing shows too much at once (the role checklist plus the situation checklist, often 10-14 rows in grey cards with icons, info buttons and a footer). Make it minimal: only the 6-8 items that matter for this role and situation, each a short answer with its source link, visible without clicking (scrolling is fine). "Not documented" needs no link.

## Acceptance criteria

- [ ] With a model configured, the model picks the 6-8 most relevant items for role + situation (allergies always included) before extraction; situation-specific extra items come from the same call.
- [ ] Without a model (or if selection fails), a rule picks them: the situation's items, allergies, then the role's top items, capped at 8.
- [ ] Extraction asks for 1-2 facts per item.
- [ ] Flat list layout: no section cards or section titles, no status icons, no info buttons, no "Ready in" text or footer paragraph. Item label small and muted, answer with source link inline.
- [ ] "Not documented" rows are one muted line without a link.
- [ ] lint, typecheck, unit tests pass; e2e selectors still work.

## Notes

Requested by mirraman: "rethink ai to be much more minimalistic ... the screen shows the expected answer without clicking (scrolling is fine), with a link to one of its source documents".

## Log

- 2026-10-30, Devin: claimed.
