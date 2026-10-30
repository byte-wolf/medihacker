---
id: T-006
title: Show contradictions inline instead of a permanent panel
status: review
owner: Devin (https://app.devin.ai/sessions/110cff77a54f439799b0e2128c832bfc)
branch: feat/ui-briefing-redesign
pr: https://github.com/byte-wolf/medihacker/pull/3
depends_on: []
touches: [components/workspace/Workspace.tsx, components/workspace/ContradictionsPanel.tsx, components/workspace/SourceTags.tsx, components/workspace/BriefingView.tsx, app/globals.css]
---

## Goal

Do not show document contradictions permanently. If a piece of information in the briefing or in an answer is part of a contradiction, show a red badge/box next to it describing the contradiction. Clicking it must still reveal the conflicting passages and details.

## Acceptance criteria

- [ ] No always-visible contradictions panel
- [ ] Red contradiction box next to affected facts in briefing and chat answers, with a short description
- [ ] Clicking the box shows the details and links to all conflicting passages

## Notes

Part of the UI/UX batch requested by Martin; T-001 to T-006 are built together on one branch because they touch the same workspace components.

## Log

- 2026-10-30, Devin: claimed together with T-001–T-006.
- 2026-10-30, Devin: PR opened, ready for review.
