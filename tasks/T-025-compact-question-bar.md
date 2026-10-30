---
id: T-025
title: Compact question bar and Q&A section
status: in_progress
owner: Devin for mirraman (https://app.devin.ai/sessions/b5e677a322d14b239181836c7ede0378)
branch: feat/t-025-compact-question-bar
pr:
depends_on: []
touches: [components/workspace/ChatPanel.tsx, app/globals.css]
---

## Goal

The sticky question bar and the "Questions and answers" block below it take too much vertical space (tall 48 px Ask button, loose padding, large heading, a redundant "Ask a question in the bar above." line). Make them compact and tidier, inside the existing Carbon look.

## Acceptance criteria

- [ ] Question bar is visibly shorter: input and Ask button share one height, tighter padding and chips
- [ ] Q&A heading and lead are smaller and tighter; no redundant empty-state line
- [ ] Behaviour unchanged (sticky bar, suggestions, `/` shortcut, answers thread)

## Notes

Requested by mirraman ("this gap is too huge, make it more compact and nicer"), done with the Impeccable skill (layout/polish).

## Log

- 2026-10-30, Devin: claimed.
- 2026-10-30, Devin: in progress on feat/t-025-compact-question-bar (PR to be opened by mirraman).
- 2026-10-30, Devin: added viewport-fit layout (no empty space under Q&A, checked 1366x768 to 3840x2160) on the same branch.
