---
id: T-015
title: Add the Impeccable design skill for agents
status: in_progress
owner: Devin (https://app.devin.ai/sessions/110cff77a54f439799b0e2128c832bfc)
branch: chore/impeccable-skill
pr:
depends_on: []
touches: [.devin/skills/impeccable/, .gitignore, AGENTS.md]
---

## Goal

Vendor the Impeccable skill (https://impeccable.style, Apache 2.0) into the repo so every Devin agent working on medihacker can use its design commands (`/impeccable polish`, `audit`, `critique`, `distill`, ...) for UI work.

## Acceptance criteria

- [ ] `.devin/skills/impeccable/` contains the upstream Devin build, unmodified
- [ ] Downloaded engine binaries (`scripts/bin/`) are gitignored
- [ ] AGENTS.md mentions the skill

## Notes

Generated files from github.com/pbakaus/impeccable `.devin/skills/impeccable`. Update by copying that folder again.

## Log

- 2026-10-30, Devin: claimed.
