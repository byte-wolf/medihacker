---
id: T-016
title: Resolve German clinical abbreviations correctly (KM = Kontrastmittel)
status: in_progress
owner: Anna (Claude Code)
branch: fix/t-016-clinical-abbreviations
pr:
depends_on: []
touches: [lib/llm/prompts.ts, lib/llm/glossary.ts, lib/data/translations.ts, scripts/llm-smoke.ts, tests/unit/]
---

## Goal

The model translated "KM-Allergie" as "cow's milk allergy". In German clinical documents KM means Kontrastmittel (contrast medium). A wrong CAVE translation is a patient-safety risk. All prompts must resolve German clinical abbreviations the same, correct way, and a code check must stop the known mistranslation even if a model gets it wrong.

## Acceptance criteria

- [ ] One glossary of German clinical abbreviations (KM, ASS, RR, Z.n., V.a., …) used by the translation, extraction, chat and contradiction prompts
- [ ] Translations expand abbreviations, e.g. "contrast medium (KM) allergy", instead of keeping them opaque
- [ ] A translation that turns KM into "milk" is rejected; the German original is shown instead
- [ ] Stored translations are refreshed when the prompt version changes
- [ ] `bun run llm:smoke` uses the app's translation prompt and fails on a KM mistranslation

## Notes

Found by `bun run llm:smoke`, whose own minimal prompt had no clinical context. The briefing already said "Contrast media allergy", but the translation prompt told the model to keep abbreviations unchanged.

## Log

- 2026-10-30, Anna (Claude Code): created and started.
