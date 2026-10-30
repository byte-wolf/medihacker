---
id: T-001
title: Question bar in a central position, briefing in a scrollable container
status: done
owner: Devin (https://app.devin.ai/sessions/110cff77a54f439799b0e2128c832bfc)
branch: feat/ui-briefing-redesign
pr: https://github.com/byte-wolf/medihacker/pull/3
depends_on: []
touches: [components/workspace/Workspace.tsx, components/workspace/ChatPanel.tsx, components/workspace/BriefingView.tsx, app/globals.css]
---

## Goal

Keep the question bar visible at all times, but move it to a more central vertical position instead of pinning it to the bottom of the window. Turn the briefing into a smaller container that scrolls internally (or can be expanded/collapsed) while keeping a consistent position on screen.

## Acceptance criteria

- [ ] Question bar is always visible without scrolling and sits roughly mid-screen, below the briefing container
- [ ] Briefing is a fixed-height container with internal scrolling and an expand/collapse toggle
- [ ] Layout still works on narrow screens (≤1055 px)

## Notes

Part of the UI/UX batch requested by Martin; T-001 to T-006 are built together on one branch because they touch the same workspace components.

## Log

- 2026-10-30, Devin: claimed together with T-001–T-006.
- 2026-10-30, Devin: PR opened, ready for review.
- 2026-10-30, Devin: PR #3 merged into main after re-testing.
