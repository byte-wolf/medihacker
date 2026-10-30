---
id: T-003
title: Info button with 'why this matters' modal for each briefing item
status: in_progress
owner: Devin (https://app.devin.ai/sessions/110cff77a54f439799b0e2128c832bfc)
branch: feat/ui-briefing-redesign
pr:
depends_on: []
touches: [components/workspace/ItemRow.tsx, components/workspace/BriefingView.tsx, app/api/explain/route.ts, lib/llm/prompts.ts, lib/briefing/explain.ts]
---

## Goal

Add an information button next to each element of the briefing. Clicking it opens a modal explaining why this information is relevant for the role and situation, optionally with a link to an up-to-date guideline at the bottom. Only for the briefing, not for chat answers.

## Acceptance criteria

- [ ] Info button on every briefing item (not in chat)
- [ ] Modal explains relevance for this role + situation; optional guideline link at the bottom
- [ ] Explanations are cached per situation and role (repeat opens are instant, survive reloads)
- [ ] Token limit and time cutoff before generating; on timeout a short fallback text is shown

## Notes

Part of the UI/UX batch requested by Martin; T-001 to T-006 are built together on one branch because they touch the same workspace components.

## Log

- 2026-10-30, Devin: claimed together with T-001–T-006.
