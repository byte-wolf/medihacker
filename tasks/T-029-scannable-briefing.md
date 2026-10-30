---
id: T-029
title: Make the briefing easier to scan for clinicians
status: review
owner: Devin (https://app.devin.ai/sessions/6855a46d71654c7f8096ba37614dba04)
branch: feat/t-029-scannable-briefing
pr:
depends_on: []
touches: [components/workspace/BriefingView.tsx, components/workspace/ItemRow.tsx, components/workspace/SourceTags.tsx, app/globals.css]
---

## Goal

The briefing was too detailed: a source link after every fact, a full row per "Not documented" item and a three-line legend. Make the answers read first.

## Acceptance criteria

- [x] Sources in a quiet right-hand column; one link (latest document) per item or fact, "+N" reveals the rest.
- [x] Items with the same sources show them once per item.
- [x] Not documented / not verified items collapse into one line at the end (reason in tooltip); allergies and antithrombotics stay in place.
- [x] One-line legend.
- [x] Every answer still visible without a click, with at least one source link (eval rule).

## Log

- 2026-10-30, Devin: built on `feat/t-029-scannable-briefing`; lint, typecheck, unit tests pass.
