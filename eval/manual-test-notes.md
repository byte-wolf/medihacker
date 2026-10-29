# Manual test notes

Date: 2026-10-29. Build: dev server and production build (`next build && next start`), Chromium, 1440×900 and 768×1024 (tablet). LLM: **not configured** (keyword-retrieval mode). The runs with the IBM Bob model are still to do.

## What was checked

| Area | Result |
|---|---|
| Login: typing a user name, unknown user, one-click demo users | OK. The first version used a ComboBox whose open list covered the "Log in" button. The E2E tests caught it, so it was replaced by a text field plus demo-user buttons. |
| Header shows name, role and department; logout | OK. The user block was invisible (white on white) at first; fixed. |
| Patient list → workspace; patient banner with age at the latest document and the CAVE allergy | OK. The allergy text was truncated in the tag; tags are no longer truncated (evidence must stay readable). |
| Situation dropdown: None, own/assigned, example presets; URL keeps the situation across reloads | OK |
| Briefing changes with the role (GP vs. anaesthetist vs. surgeon) and the situation (diabetes section first for "Diabetes review") | OK |
| "Not documented" rows (e.g. renal function) | OK |
| Source panel: opens beside the briefing, scrolls to and highlights the passage, Esc closes | OK after fixes. The scroll moved the whole page (now only the panel scrolls), and Esc was swallowed by the button tooltip (now a capture-phase listener). |
| Contradictions rail: 6 rule-based contradictions, English titles, links to every passage | OK. Titles first used German document titles; now they show "Discharge letter, 28 Jun 2015". |
| Contradiction tag on a fact → focuses the contradiction card | OK |
| Tablet width: rail moves below the briefing, with a link at the top that jumps to it | OK. The first version put a link inside a Carbon InlineNotification, which Carbon rejects at runtime. That crashed the page in the production build; replaced by a plain styled link. A root error boundary now catches such errors without showing partial content. |
| Dark theme toggle | OK |
| Accessibility (axe, WCAG 2 A/AA, serious + critical) on login, patient list and workspace with the source panel open | 0 violations (automated in E2E) |

## Not yet checked (needs the model)

- English summarised facts, situation-specific questions, chat answers, translations, the LLM contradiction scan.
- Load time under 10 s with the real model, and the 15 official questions (`bun run eval`).
