---
id: T-007
title: Show no briefing when no situation is selected
status: done
owner: Devin (https://app.devin.ai/sessions/110cff77a54f439799b0e2128c832bfc)
branch: feat/ui-polish-2
pr: https://github.com/byte-wolf/medihacker/pull/4
depends_on: []
touches: [components/workspace/BriefingView.tsx, components/workspace/Workspace.tsx]
---

## Goal

With 'None (questions only)' selected, show no briefing at all and no 'select a situation' list.

## Acceptance criteria

- [x] No briefing box and no situation list when no situation is selected
- [x] Question bar and chat still work

## Notes

Second UI batch requested by Martin; T-007 to T-014 are built together on one branch.

## Log

- 2026-10-30, Devin: claimed together with T-007–T-014.
- 2026-10-30, Devin: implemented and tested, PR #4 open for review.
- 2026-10-30, Devin: PR #4 merged into main.
