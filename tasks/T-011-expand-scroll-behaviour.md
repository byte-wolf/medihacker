---
id: T-011
title: Fix expand/collapse scrolling of the briefing
status: in_progress
owner: Devin (https://app.devin.ai/sessions/110cff77a54f439799b0e2128c832bfc)
branch: feat/ui-polish-2
pr:
depends_on: []
touches: [components/workspace/BriefingView.tsx, app/globals.css]
---

## Goal

When expanded, scrolling is broken. Expanded briefing should scroll with the page, and the question bar should only appear after the end of the briefing.

## Acceptance criteria

- [ ] Collapsed: internal scrolling, question bar visible
- [ ] Expanded: page scrolls normally, question bar not sticky, appears after the briefing

## Notes

Second UI batch requested by Martin; T-007 to T-014 are built together on one branch.

## Log

- 2026-10-30, Devin: claimed together with T-007–T-014.
