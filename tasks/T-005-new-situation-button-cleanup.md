---
id: T-005
title: Remove the 'New situation' button from the context bar
status: done
owner: Devin (https://app.devin.ai/sessions/110cff77a54f439799b0e2128c832bfc)
branch: feat/ui-briefing-redesign
pr: https://github.com/byte-wolf/medihacker/pull/3
depends_on: []
touches: [components/workspace/ContextBar.tsx]
---

## Goal

Remove the 'New situation' button from the row with Perspective and Situation. Creating a new situation is only done via the situation dropdown ('+ New situation…').

## Acceptance criteria

- [ ] No 'New situation' button in the context bar
- [ ] '+ New situation…' in the dropdown still opens the create dialog

## Notes

Part of the UI/UX batch requested by Martin; T-001 to T-006 are built together on one branch because they touch the same workspace components.

## Log

- 2026-10-30, Devin: claimed together with T-001–T-006.
- 2026-10-30, Devin: PR opened, ready for review.
- 2026-10-30, Devin: PR #3 merged into main after re-testing.
