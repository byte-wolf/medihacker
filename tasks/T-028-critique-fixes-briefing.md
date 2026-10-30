---
id: T-028
title: Fix the Impeccable critique findings on the briefing workspace
status: in_progress
owner: Devin for mirraman (https://app.devin.ai/sessions/6142ae58ff4a4f9f8dd116e56624138a)
branch: feat/t-028-critique-fixes
pr:
depends_on: [T-026]
touches: [components/workspace/, app/globals.css, lib/contradictions/, lib/briefing/, lib/catalog/, tests/]
---

## Goal

The Impeccable critique of the minimal briefing (T-026 branch) scored 25/40. Fix every finding: red is used on weight/BMI rows while the allergy is plain text; the briefing is trapped in a small inner scroll box with a heavy sticky ask bar; repeated blue source links dominate; regex bolding is random; plus smaller polish (label wrapping, "Not documented" weight, focus ring, chip contrast, Expand wording).

## Acceptance criteria

- [ ] Red is reserved for safety facts (allergies, anticoagulants); data conflicts use amber with a visible text label; allergies always first.
- [ ] Briefing flows with the page (no nested scroll box); compact question bar sticks to the bottom; works at 390 px and 2560 px.
- [ ] One quiet, short source link per documented fact, still visible without a click; "Not documented" has no link.
- [ ] Bold only on the clinical value (drug + dose, number + unit, allergen).
- [ ] Token count stays visible in the briefing header (requested by mirraman for testing).
- [ ] lint, typecheck, unit tests pass; Impeccable re-critique scores higher with no P0/P1.

## Notes

Built on `feat/t-026-minimal-briefing` (not yet merged). Work is split across parallel agents (safety/typography, layout, sources) and merged into `feat/t-028-critique-fixes`.

## Log

- 2026-10-30, Devin: claimed.
- 2026-10-30, Devin: 3 parallel fix agents (safety/typography, layout, sources) merged into feat/t-028-critique-fixes; collapsible question bar and source-close tooltip fix added on request. Independent re-critique: 30/40, no P0/P1. lint/typecheck/169 unit tests pass; e2e not run (needs ./data). PR base should be feat/t-026-minimal-briefing until T-026 merges.
