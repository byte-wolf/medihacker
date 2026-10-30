---
id: T-002
title: Loading spinner while an AI answer is generated
status: in_progress
owner: Devin (https://app.devin.ai/sessions/110cff77a54f439799b0e2128c832bfc)
branch: feat/ui-briefing-redesign
pr:
depends_on: []
touches: [components/workspace/ChatPanel.tsx, app/globals.css]
---

## Goal

Show a loading spinner whenever a question is submitted, until the AI's answer is fully generated and displayed.

## Acceptance criteria

- [ ] Spinner appears immediately after submitting (button and/or bar) and in the thread
- [ ] Spinner disappears only when the answer (or an error) is displayed

## Notes

Part of the UI/UX batch requested by Martin; T-001 to T-006 are built together on one branch because they touch the same workspace components.

## Log

- 2026-10-30, Devin: claimed together with T-001–T-006.
