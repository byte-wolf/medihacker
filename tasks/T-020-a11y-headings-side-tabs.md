---
id: T-020
title: Remove empty headings and side-tab borders
status: review
owner: Devin (https://app.devin.ai/sessions/110cff77a54f439799b0e2128c832bfc)
branch: feat/impeccable-review
pr: https://github.com/byte-wolf/medihacker/pull/9
depends_on: []
touches: [components/workspace/*.tsx, app/globals.css]
---

## Goal

Closed Carbon modals leave empty h2 elements in the heading outline; Impeccable flags the 3 px coloured left borders as an AI-look pattern. (From the Impeccable critique of the patient workspace.)

## Acceptance criteria

- [x] No empty headings in the outline; no side-tab borders (detector clean)

## Log

- 2026-10-30, Devin: claimed.
- 2026-10-30, Devin: in review (PR #9).
