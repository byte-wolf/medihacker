---
id: T-017
title: Collapsed briefing fills the free window height
status: in_progress
owner: Devin (https://app.devin.ai/sessions/110cff77a54f439799b0e2128c832bfc)
branch: feat/impeccable-review
pr:
depends_on: []
touches: [app/globals.css, components/workspace/Workspace.tsx]
---

## Goal

The collapsed briefing box is ~290 px on a 900 px window while the empty Q&A area takes the rest. Let it use the free height and shrink back once there are answers. (From the Impeccable critique of the patient workspace.)

## Acceptance criteria

- [ ] Collapsed briefing uses the available height with no answers; shrinks when the chat has answers; expand/collapse behaviour unchanged

## Log

- 2026-10-30, Devin: claimed.
