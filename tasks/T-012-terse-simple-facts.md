---
id: T-012
title: Terse statements for simple values
status: done
owner: Devin (https://app.devin.ai/sessions/110cff77a54f439799b0e2128c832bfc)
branch: feat/ui-polish-2
pr: https://github.com/byte-wolf/medihacker/pull/4
depends_on: []
touches: [lib/llm/prompts.ts]
---

## Goal

Simple facts are too wordy, e.g. 'Blood pressure at the most recent visit on April 5, 2016, was 145/88 mmHg.' should be '145/88 mmHg (5 Apr 2016)'. Complex findings stay as they are.

## Acceptance criteria

- [x] Simple measurements shown as value + date
- [x] Complex facts unchanged
- [x] Eval does not regress

## Notes

Second UI batch requested by Martin; T-007 to T-014 are built together on one branch.

## Log

- 2026-10-30, Devin: claimed together with T-007–T-014.
- 2026-10-30, Devin: implemented and tested, PR #4 open for review.
- 2026-10-30, Devin: PR #4 merged into main.
