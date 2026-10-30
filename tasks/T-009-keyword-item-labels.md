---
id: T-009
title: Keyword-style labels for situation-specific items
status: review
owner: Devin (https://app.devin.ai/sessions/110cff77a54f439799b0e2128c832bfc)
branch: feat/ui-polish-2
pr: https://github.com/byte-wolf/medihacker/pull/4
depends_on: []
touches: [lib/llm/prompts.ts]
---

## Goal

Situation-specific items in the last briefing section read as long questions. Use short keyword phrases instead, e.g. 'dental issues or neck mobility affecting airway access' instead of 'Are there dental issues or limited neck mobility affecting airway access?'.

## Acceptance criteria

- [x] Generated item labels are keyword phrases, no question form
- [x] Eval does not regress

## Notes

Second UI batch requested by Martin; T-007 to T-014 are built together on one branch.

## Log

- 2026-10-30, Devin: claimed together with T-007–T-014.
- 2026-10-30, Devin: implemented and tested, PR #4 open for review.
