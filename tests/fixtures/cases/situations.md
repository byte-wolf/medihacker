# Situations (synthetic fixtures)

These cases use the three fictional patients under [`../patients/`](../patients). Point the app at them with `PATIENT_DATA_DIR=./tests/fixtures/patients` (and reset the app database when switching data dirs). Type the title and description of a situation into your app. The questions are only for checking the screen. In every situation, your app should search all of the patient's documents. Questions in the present tense, such as "Which drug does he take?", mean as of the date of the latest document of that patient. If something is not documented, the correct answer is "not documented". The expected answers are in [`expected.json`](expected.json).

## Patient TEST-0001: Testpatient Otto Beispiel, born 14 February 1949 (8 documents, latest document 25 October 2024)

### 1. Medication review at the GP

You are his general practitioner (GP), reviewing his chronic medication after the October 2024 hospital stay.

1. Which antihypertensive drugs (blood pressure drugs) does he take and at what doses?
2. What is his latest HbA1c (long-term blood sugar) and from when?
3. Is his kidney function documented?

### 2. Planning a CT with iodinated contrast

You are his treating physician and consider a CT scan with iodinated contrast (the dye for CT imaging).

1. Which allergies are documented?
2. Which drug makes giving iodinated contrast a concern?

### 3. Carotid stenosis follow-up

You are his GP reviewing the carotid artery stenosis.

1. On which side is the carotid stenosis?
2. How severe is the stenosis?
3. Is there a record that the recommended pneumology follow-up (six months after March 2024) took place?

## Patient TEST-0002: Testpatientin Erika Muster, born 3 September 1967 (6 documents, latest document 12 March 2025)

### 4. Pre-operative anaesthesia check

You are the anaesthetist checking her file before the planned gallbladder operation.

1. Which allergies are documented?
2. Does she take any anticoagulant or antiplatelet drug (blood thinner) permanently?
3. What is her ASA classification and airway assessment?

### 5. Review after discharge

You are her GP reviewing the hospital stay after she was discharged.

1. Which operation was performed and when?
2. What did the pre-operative laboratory show?
3. Is a blood group or crossmatch documented?

## Patient TEST-0003: Testpatient Franz Schema, born 30 June 1957 (7 documents, latest document 12 May 2025)

### 6. Chemotherapy protocol check

You are the oncologist checking his chemotherapy protocol.

1. Which chemotherapy protocol is he on, and what are the doses?
2. What is the stage of his colon cancer (tumour size, lymph nodes, spread)?
3. Which vascular access for the chemotherapy is documented?

### 7. Fever during chemotherapy, night shift

You are the emergency physician on night duty. He arrives with a fever eight days after his third chemotherapy cycle.

1. How low are his blood counts (cytopenias)?
2. What treatment did he receive for the febrile neutropenia?
3. What is planned for chemotherapy cycle 4?
4. Which allergy is documented?
