# Synthetic patient fixtures

Three entirely fictional patients for tests, mirroring the real data layout in
`data/data/patient-0000-0001/` (IBM Medical Cockpit demo format). Nothing here is
copied from real data — all names, IDs and clinical content were invented for
this repository.

## Usage

Point the app (or a test) at this directory instead of the real data:

```
PATIENT_DATA_DIR=./tests/fixtures/patients
```

Patient lookup works exactly like the real data: `getPatient("TEST-0001")` or the
folder name `patient-TEST-0001`. Each folder contains the same files as the real
patient: `patient.json`, `documents.json`, `documents/<id>.json`,
`diagnoses.json`, `procedures.json`, `medication.json`, `scores-all.json`,
`scores-latest.json`, `cave.json` and `metadata.json`. The app itself only reads
`patient.json`, `documents.json` and `documents/<id>.json` (`text` field); the
other files are kept for format fidelity. See `data/data/README.md` for the file
semantics (German clinical text, `<BR>` line breaks, HTML entities, dates as
`YYYY-MM-xx`).

Accompanying Q&A cases (same format as `data/cases/`) are in
[`../cases/`](../cases): `situations.md` + `expected.json`, 7 situations with 21
questions covering all three patients, including the planted contradictions and
gaps described below.

## patient-TEST-0001 — Testpatient Otto Beispiel (male, born 1949-02-14)

Elderly multimorbid patient: arterial hypertension, type 2 diabetes, COPD GOLD
II, CKD G3a, coronary heart disease (post inferior MI 2018), carotid stenosis,
obesity. Two inpatient stays (March 2024, October 2024) and one outpatient
visit (July 2024), 8 documents.

**Planted contradictions** (an app should surface these):

1. *Allergy lists differ.* Discharge letters `91010104` (Mar 2024) and
   `91010108` (Oct 2024) document a **penicillin allergy (exanthem)**; the
   outpatient letter `91010105` (Jul 2024) documents an **iodinated contrast
   media allergy (exanthem)** and omits penicillin. (Detected by semantic/LLM
   contradiction checks, not by the deterministic rules.)
2. *Carotid stenosis side.* Duplex `91010101` and letter `91010108` say
   **left** (~50%); letter `91010104` says **right**. Detected by the
   laterality rule.
3. *BMI arithmetic.* `91010104` states BMI 25.4 at 88 kg / 172 cm
   (calculated: 29.7). Detected by the BMI rule.
4. *Reused case number.* The October letter `91010108` carries `Fall:
   20240312`, the March stay's case number; the other October document
   `91010107` correctly has `20241021`. Detected by the case-number rule
   (mirrors the same bug in the real data).

Note: the CAVE file deliberately keeps the generic "Arzneimittel-Allergie"
entry (as in the real data) so the allergy-list conflict must be resolved from
the documents.

## patient-TEST-0002 — Testpatientin Erika Muster (female, born 1967-09-03)

Surgical patient: symptomatic cholelithiasis, elective laparoscopic
cholecystectomy on 10 March 2025; mild hypertension (ASA II). Two outpatient
visits (surgery consult + pre-anaesthesia evaluation/lab) and one inpatient
stay for the operation, 6 documents.

**Planted gaps** (facts a clinician would expect that are *not documented*):

1. *Allergy status.* No document — including the pre-anaesthesia evaluation
   `91020103` and the discharge letter `91020106` — records any allergy
   information; `cave.json` has an empty `adverseReactions` list. Correct
   answer to "which allergies are documented": not documented.
2. *Blood group / crossmatch.* Not documented (secondary gap for question
   5.3).

No contradictions were planted; the deterministic contradiction rules return
zero findings for this patient.

## patient-TEST-0003 — Testpatient Franz Schema (male, born 1957-06-30)

Oncology patient: moderately differentiated adenocarcinoma of the ascending
colon pT3 pN1 (2/24) cM0 G2 R0 (MSS, KRAS-mutated), post right hemicolectomy
(Feb 2025), on adjuvant XELOX chemotherapy. Cycle 3 was followed by febrile
neutropenia (inpatient stay May 2025). 7 documents, including the treatment
protocol (`91030103`) and a lab document (`91030106`) showing cytopenias
(leukocytes 1.9, neutrophils 0.7, platelets 92, Hb 10.8, CRP 86).

No contradictions and no required gaps. A documented iodinated contrast media
allergy exists consistently in `cave.json` and both discharge letters.

## Conventions

- Document IDs are 8-digit numbers (`9101xxxx`/`9102xxxx`/`9103xxxx`);
  admission IDs are `TEST-0x0y`. All clearly synthetic.
- Fictional hospital: "Testklinikum Musterstadt". Document `type`/`group`/
  `division` values reuse the vocabulary of the real data
  (`Arztbrief(Inter.)`, `Ambulanzbrief(Inter.)`, `HistoBefund`, `Bildgebung`,
  `Konsil`, ...).
- Medication tables use the real `mo mi ab na` (morning/midday/evening/night)
  format; codes are real ATC/ICD-10 where applicable, MEL procedure codes are
  invented lookalikes.
