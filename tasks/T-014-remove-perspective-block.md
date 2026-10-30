---
id: T-014
title: Remove the Perspective block from the context bar
status: done
owner: Devin (https://app.devin.ai/sessions/110cff77a54f439799b0e2128c832bfc)
branch: feat/ui-polish-2
pr: https://github.com/byte-wolf/medihacker/pull/4
depends_on: []
touches: [components/workspace/ContextBar.tsx, app/globals.css]
---

## Goal

The role is already in the header, so the Perspective text next to the situation selector is clutter.

## Acceptance criteria

- [x] No Perspective block; situation selector and New conversation remain

## Notes

Second UI batch requested by Martin; T-007 to T-014 are built together on one branch.

## Log

- 2026-10-30, Devin: claimed together with T-007–T-014.
- 2026-10-30, Devin: implemented and tested, PR #4 open for review.
- 2026-10-30, Devin: PR #4 merged into main.
