// Example situations per role, seeded for each demo user, plus questions the
// question bar suggests. They describe tasks, not patient facts.

export type RoleSituation = { title: string; description: string; questions: string[] };

export const ROLE_SITUATIONS: Record<string, RoleSituation[]> = {
  Anaesthetist: [
    {
      title: "Anaesthesia consent conversation",
      description: "You are the anaesthetist. The day before her breast surgery you explain the anaesthesia plan and its risks to her.",
      questions: ["Has she reacted to anaesthesia or contrast media before?", "Does she have sleep apnoea or reflux?", "Which drugs should she stop before surgery?"],
    },
    {
      title: "High blood pressure in the recovery room",
      description: "You are the anaesthetist in the recovery room. After her breast surgery her blood pressure is 185/100 mmHg.",
      questions: ["Which blood pressure drugs does she take, and when?", "Has she had a hypertensive crisis before?", "Is there a known carotid stenosis?"],
    },
    {
      title: "Glucose management on the day of surgery",
      description: "You are the anaesthetist planning her blood glucose management while she fasts on the day of surgery.",
      questions: ["Which glucose-lowering drugs does she take?", "What is her latest HbA1c?", "Is her kidney function documented?"],
    },
  ],
  "Breast surgeon": [
    {
      title: "Marking and consent before the quadrantectomy",
      description: "You are the breast surgeon on the morning of the operation, marking the operation site and confirming consent.",
      questions: ["On which side and in which quadrant is the tumour?", "How large is the lesion on imaging?", "Were axillary lymph nodes enlarged?"],
    },
    {
      title: "Ward round on the first day after surgery",
      description: "You are the breast surgeon on the ward round the day after her quadrantectomy, checking bleeding risk and wound healing.",
      questions: ["Does she take antiplatelet or anticoagulant drugs?", "Is her diabetes well controlled?", "Does she take any drug that affects wound healing?"],
    },
    {
      title: "Explaining the biopsy result",
      description: "You are the breast surgeon explaining the core biopsy result and the next steps to her.",
      questions: ["What is the histology and TNM stage?", "What is the receptor status?", "What did the tumour board recommend?"],
    },
  ],
  "General practitioner": [
    {
      title: "Cardiovascular risk review",
      description: "You are her GP doing a yearly cardiovascular risk review.",
      questions: ["Which lipid-lowering drug does she take?", "What did the 24-hour blood pressure measurement show?", "Is a carotid stenosis documented?"],
    },
    {
      title: "Review after weight loss",
      description: "You are her GP. She has lost weight over the last year and you review her diabetes medication.",
      questions: ["How did her weight change, and when?", "Which glucose-lowering drugs does she take?", "What is her latest HbA1c?"],
    },
    {
      title: "Osteoporosis follow-up",
      description: "You are her GP reviewing her osteoporosis treatment.",
      questions: ["Which bone medication does she take, and how often?", "Is vitamin D deficiency documented?", "Is a bone density result documented?"],
    },
  ],
  "Emergency physician": [
    {
      title: "Chest pain at night",
      description: "You are the emergency physician on night duty. She arrives with chest pain.",
      questions: ["What did the last echocardiography show?", "Does she take blood thinners?", "Was her heart rhythm normal on the Holter ECG?"],
    },
    {
      title: "Low blood sugar",
      description: "You are the emergency physician. She is brought in confused with a blood glucose of 2.8 mmol/L.",
      questions: ["Which glucose-lowering drugs does she take?", "Is her kidney function documented?", "Has she been losing weight?"],
    },
    {
      title: "Fall with a head injury",
      description: "You are the emergency physician. She fell at home and hit her head; you consider a head CT.",
      questions: ["Does she take antiplatelet or anticoagulant drugs?", "What did the previous head CT show?", "Is a contrast allergy documented?"],
    },
  ],
  "Clinical pharmacist": [
    {
      title: "Medication reconciliation on admission",
      description: "You are the clinical pharmacist reconciling her medication when she is admitted for surgery.",
      questions: ["What is on her latest medication list?", "Which doses changed since 2015?", "Is her kidney function documented?"],
    },
    {
      title: "Interaction check before cancer therapy",
      description: "You are the clinical pharmacist checking her current drugs before adjuvant cancer therapy starts.",
      questions: ["Which drugs and doses does she currently take?", "Which chronic diseases does she have?", "Are any drug allergies documented?"],
    },
    {
      title: "Discharge counselling",
      description: "You are the clinical pharmacist counselling her on her medication before discharge.",
      questions: ["Which drugs does she inject, and how often?", "How often does she take her bone medication?", "Which drugs does she take in the morning?"],
    },
  ],
  Oncologist: [
    {
      title: "Planning adjuvant endocrine therapy",
      description: "You are the oncologist planning adjuvant endocrine therapy after her surgery.",
      questions: ["What is the hormone receptor status?", "Is osteoporosis documented, and how is it treated?", "What was the last ejection fraction?"],
    },
    {
      title: "Radiotherapy planning",
      description: "You are the radiation oncologist planning her radiotherapy after the quadrantectomy.",
      questions: ["Was intraoperative radiotherapy planned?", "Does she have an autoimmune disease such as lupus?", "On which side is the tumour?"],
    },
    {
      title: "First oncology clinic visit",
      description: "You are the oncologist seeing her for the first time after the diagnosis.",
      questions: ["What is the TNM stage and grade?", "Were axillary lymph nodes involved?", "How is her general condition?"],
    },
  ],
  "Ward nurse": [
    {
      title: "Nursing admission assessment",
      description: "You are the ward nurse doing her nursing admission assessment on the surgical ward.",
      questions: ["Which allergies are documented?", "What is her latest weight?", "Does she use any injections?"],
    },
    {
      title: "Pre-operative checklist",
      description: "You are the ward nurse completing the pre-operative checklist on the morning of surgery.",
      questions: ["Which operation is planned, and on which side?", "Which drugs does she normally take in the morning?", "Does she need an allergy wristband?"],
    },
    {
      title: "Diabetes care on the ward",
      description: "You are the ward nurse looking after her diabetes care during the hospital stay.",
      questions: ["Which glucose-lowering drugs does she take, and when?", "What is her latest HbA1c?", "Has she had low blood sugar before?"],
    },
  ],
  Radiologist: [
    {
      title: "Staging CT with contrast",
      description: "You are the radiologist asked to do a staging CT with iodinated contrast.",
      questions: ["Is a contrast reaction documented, and what happened?", "Does she take metformin?", "Is her kidney function documented?"],
    },
    {
      title: "Pre-operative wire localisation",
      description: "You are the radiologist placing a localisation wire in the breast lesion before surgery.",
      questions: ["Where is the lesion, and how large is it?", "Does she take blood thinners?", "What BI-RADS category was given?"],
    },
    {
      title: "Follow-up carotid duplex",
      description: "You are the radiologist doing a follow-up duplex ultrasound of the neck arteries.",
      questions: ["What did the previous carotid ultrasound show?", "On which side is the stenosis?", "When was the follow-up recommended?"],
    },
  ],
};

/** Questions suggested in the question bar when no situation is selected. */
export const ROLE_QUESTIONS: Record<string, string[]> = {
  Anaesthetist: ["Which allergies are documented?", "Does she take blood thinners?", "What was the last ejection fraction?"],
  "Breast surgeon": ["What is the histology and TNM stage?", "What is the receptor status?", "Does she take blood thinners?"],
  "General practitioner": ["What is on her latest medication list?", "What is her latest HbA1c?", "Which follow-ups are open?"],
  "Emergency physician": ["Which allergies are documented?", "Does she take blood thinners?", "Which chronic diseases does she have?"],
  "Clinical pharmacist": ["What is on her latest medication list?", "Which doses changed over time?", "Is her kidney function documented?"],
  Oncologist: ["What is the receptor status?", "What did the tumour board recommend?", "Which other diseases does she have?"],
  "Ward nurse": ["Which allergies are documented?", "Which drugs does she take, and when?", "What is her latest weight?"],
  Radiologist: ["Is a contrast reaction documented?", "Does she take metformin?", "What did earlier imaging show?"],
};

export const DEFAULT_QUESTIONS = ["Which allergies are documented?", "What is on her latest medication list?", "Which diagnoses are documented?"];
