---
id: T-024
title: Contradicting facts shown inside a red box
status: in_progress
owner: Devin (https://app.devin.ai/sessions/110cff77a54f439799b0e2128c832bfc)
branch: feat/logo-situation-contradiction
pr:
depends_on: [T-017, T-018, T-019, T-020]
touches: [components/workspace/ItemRow.tsx, components/workspace/SourceTags.tsx, app/globals.css, tests/e2e/app.spec.ts]
---

## Goal

Replace the contradiction flag: the whole fact sits in a red box, the reason shows on hover, clicking the box (not a source tag) opens the contradiction explainer.

## Acceptance criteria

- [ ] Red box around contradicting facts in briefing and answers; reason on hover/focus; click opens explainer; source tags still open the document

## Log

- 2026-10-30, Devin: claimed.
