---
id: T-004
title: Remove the 'Situation-specific questions' section
status: done
owner: Devin (https://app.devin.ai/sessions/110cff77a54f439799b0e2128c832bfc)
branch: feat/ui-briefing-redesign
pr: https://github.com/byte-wolf/medihacker/pull/3
depends_on: []
touches: [lib/briefing/pipeline.ts, lib/llm/prompts.ts, components/workspace/BriefingView.tsx]
---

## Goal

Remove the separate 'Situation-specific questions' section to reduce reading fatigue. Fold its content into the regular briefing sections instead; the rationale for why something was selected is now available via the info button (T-003).

## Acceptance criteria

- [ ] No 'Situation-specific questions' section in the briefing
- [ ] Situation-specific items are placed into the regular briefing sections
- [ ] Eval (15/15) does not regress

## Notes

Part of the UI/UX batch requested by Martin; T-001 to T-006 are built together on one branch because they touch the same workspace components.

## Log

- 2026-10-30, Devin: claimed together with T-001–T-006.
- 2026-10-30, Devin: PR opened, ready for review.
- 2026-10-30, Devin: PR #3 merged into main after re-testing.
