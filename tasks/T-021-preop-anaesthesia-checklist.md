---
id: T-021
title: Create new documents – Preoperative Anesthesia Checklist
status: in_progress
owner: Anna (Claude Code)
branch: feat/t-021-preop-checklist
pr:
depends_on: []
touches: [components/workspace/ContextBar.tsx, app/patients/[patientId]/documents/, app/api/patient-documents/, components/documents/, lib/documents/, lib/data/structured.ts, lib/db/schema.ts, drizzle/, app/globals.css, tests/unit/, tests/integration/]
---

## Goal

Users can create new documents for a patient. The only document for the demo is a Preoperative Anesthesia Checklist: a form pre-filled from the patient's structured data, which the user confirms, edits or completes and then saves.

## Acceptance criteria

- [ ] "+ Create New Document" button directly below "New conversation" in the workspace.
- [ ] It opens a new page with only the header (no question bar, no situation box) and a menu "What document?" with the single option "Preoperative Anesthesia Checklist".
- [ ] Form sections: A Patient identity (shown, must be confirmed), B Allergies (pre-filled, must be confirmed), C Current medication, D Medical history (conditions, previous surgery), E Examinations (dental status checkboxes, blood pressure, temperature, Mallampati, height/weight/BMI pre-filled, smoking and alcohol), F ASA score calculated automatically once the required fields are filled.
- [ ] Pre-filled values come from the patient's structured files (no LLM call) and name their source documents.
- [ ] "Save Document" stores the checklist in the database; saving without the required confirmations is refused.
- [ ] Unit and integration tests run without any API (`bun run test`).

## Notes

ASA is formally a clinical judgement. The form computes a rule-based ASA class with its reasons (ASA examples: smoking, alcohol, BMI, controlled vs. poorly controlled disease, TIA/MI history, EF), and the anaesthetist confirms or changes it before saving.

## Log

<!-- Newest last: date, who, what happened. -->
- 2026-10-30: Anna (Claude Code) claimed.
