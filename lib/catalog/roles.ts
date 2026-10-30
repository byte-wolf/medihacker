// Which kinds of facts a role or a situation needs. This is the only hard-coded
// clinical knowledge in the app (allowed by the hackathon rules); the facts
// themselves are always found in the documents at request time.

export type Category = {
  key: string;
  /** What the clinician sees as the row label */
  label: string;
  /** Guidance for the extraction model: what counts, what to include */
  guidance: string;
  /** German/English terms used for the retrieval fallback and relevance matching */
  terms: RegExp;
};

export const CATEGORIES: Record<string, Category> = {
  demographics: {
    key: "demographics",
    label: "Age and sex",
    guidance: "Age at the latest document (calculate from date of birth) and sex.",
    terms: /geb\.|jährig|patientin/i,
  },
  allergies: {
    key: "allergies",
    label: "Allergies and intolerances",
    guidance: "Every documented allergy (CAVE) with the reaction. Include contrast media, drugs, latex.",
    terms: /allergi|unverträglich|cave|\bKM\b/i,
  },
  antithrombotics: {
    key: "antithrombotics",
    label: "Antithrombotic drugs (anticoagulants, antiplatelets)",
    guidance: "Current antiplatelet or anticoagulant drugs with dose and schedule (morning-midday-evening). Give the generic name.",
    terms: /\bASS\b|aspirin|acetylsalicyl|clopidogrel|marcumar|xarelto|eliquis|lixiana|pradaxa|heparin|lovenox|thrombozytenaggregation/i,
  },
  current_medication: {
    key: "current_medication",
    label: "Current medication (latest list)",
    guidance: "Every drug on the most recent medication list with dose and schedule, brand and generic name. Mention changes versus the previous list.",
    terms: /mg\b|mcg|µg|tropfen|oral|s\.c\.|tabl|medikation/i,
  },
  medication_changes: {
    key: "medication_changes",
    label: "Medication changes over time",
    guidance: "Doses or drugs that differ between medication lists or were started/adjusted, with both dates.",
    terms: /anpassung|begonnen|umgestellt|abgesetzt|mg\b/i,
  },
  glucose_lowering: {
    key: "glucose_lowering",
    label: "Glucose-lowering drugs",
    guidance: "Every antidiabetic drug (oral and injectable, e.g. metformin, pioglitazone, GLP-1 agonists, insulin) with dose and schedule.",
    terms: /glucophage|metformin|actos|pioglitazon|byetta|exenatid|insulin|januvia|sitagliptin|ozempic|victoza|antidiabet/i,
  },
  antihypertensives: {
    key: "antihypertensives",
    label: "Antihypertensive drugs",
    guidance: "Every blood pressure drug with dose and schedule; note changes between lists.",
    terms: /blopress|candesartan|sartan|pril\b|amlodipin|bisoprolol|metoprolol|hct|diuret|antihypertens/i,
  },
  diabetes_control: {
    key: "diabetes_control",
    label: "Diabetes control (HbA1c)",
    guidance: "Latest HbA1c with date and any statement about diabetes control. Say if no later value exists.",
    terms: /hba1c|diabetes|DMII|NIDDM|blutzucker/i,
  },
  weight_trend: {
    key: "weight_trend",
    label: "Weight, height and BMI over time",
    guidance:
      "One fact per weighing: 'Weight X kg (date)', quoting that document's weight line; never combine values from different documents in one fact. The latest weight is the one in the most recently dated document. Then one calculated fact for the change between the first and the latest weight, citing both weight lines.",
    terms: /gewicht|größe|BMI|kg\b/i,
  },
  blood_pressure: {
    key: "blood_pressure",
    label: "Blood pressure",
    guidance: "Documented blood pressure values with dates, 24-h measurement results, hypertensive episodes.",
    terms: /\bRR\b|mmHg|blutdruck|hypert/i,
  },
  cardiac_function: {
    key: "cardiac_function",
    label: "Cardiac function (echo, ECG, rhythm)",
    guidance: "Last echocardiography (LV ejection fraction, valves), ECG and Holter results with dates.",
    terms: /\bEF\b|echokard|ventrikel|\bEKG\b|sinusrhythmus|\bherz|klappe|TAPSE/i,
  },
  renal_function: {
    key: "renal_function",
    label: "Renal function (creatinine, eGFR)",
    guidance: "Creatinine, eGFR or any statement about kidney function. Lab tables without values do not count.",
    terms: /kreatinin|creatinin|eGFR|niere|renal|GFR/i,
  },
  airway_osa: {
    key: "airway_osa",
    label: "Airway and sleep apnoea, aspiration risk",
    guidance: "Sleep apnoea, reflux (GERD) / hiatal hernia (aspiration risk), airway notes.",
    terms: /schlafapnoe|apnoe|reflux|GERD|hiatus|atemweg|intubation/i,
  },
  comorbidities: {
    key: "comorbidities",
    label: "Relevant comorbidities",
    guidance: "Diagnoses from the most recent diagnosis lists that matter for this task.",
    terms: /diagnosen|lupus|SLE|osteoporose|hyperlipid|hypercholest|CHE|hypertonie/i,
  },
  planned_procedure: {
    key: "planned_procedure",
    label: "Planned procedure and date",
    guidance: "Planned operations or interventions with date and location.",
    terms: /geplant|procedere|quadranten|IORT|resektion|operation|termin/i,
  },
  tumour_histology: {
    key: "tumour_histology",
    label: "Histology and TNM stage",
    guidance: "Tumour type, side, TNM, grade, date of biopsy.",
    terms: /histolog|karzinom|TNM|T\d\s*N\d|G\d|stanz/i,
  },
  tumour_receptors: {
    key: "tumour_receptors",
    label: "Receptor status and Ki-67",
    guidance: "Oestrogen/progesterone receptor (percent, Allred score), HER2, Ki-67.",
    terms: /rezeptor|allred|her2|ki-?67/i,
  },
  tumour_imaging: {
    key: "tumour_imaging",
    label: "Breast imaging and axillary status",
    guidance: "Mammography/ultrasound findings, size, BI-RADS, axillary lymph nodes, with dates.",
    terms: /mammograph|sonograph|BI-RADS|läsion|lymphknoten|axill|ausdehnung/i,
  },
  tumour_board: {
    key: "tumour_board",
    label: "Tumour board recommendation and schedule",
    guidance: "What the tumour board recommended and the scheduled date.",
    terms: /tumorboard|empfohlen|IORT|quadranten/i,
  },
  prior_events: {
    key: "prior_events",
    label: "Similar previous events and their cause",
    guidance: "Earlier episodes resembling the current complaint, what was found and the attributed cause, with dates.",
    terms: /krise|schwindel|seh|amaurosis|zurückgeführt|ursache/i,
  },
  vascular_findings: {
    key: "vascular_findings",
    label: "Vascular findings (carotid, stenosis side)",
    guidance: "Carotid and other vessel findings with side and degree of stenosis, with dates and the examination.",
    terms: /carotis|karotis|stenose|arteri|duplex|doppler|vertebralis/i,
  },
  contrast_safety: {
    key: "contrast_safety",
    label: "Before iodinated contrast",
    guidance: "Contrast allergy and reaction, previous imaging done without contrast for that reason, metformin, renal function.",
    terms: /\bKM\b|KM-|kontrast|\bnativ|glucophage|metformin|kreatinin|allergi/i,
  },
  eye_findings: {
    key: "eye_findings",
    label: "Eye findings",
    guidance: "Ophthalmology findings (fundus, retinopathy, amaurosis fugax) and recommended eye checks.",
    terms: /auge|fundus|retin|amaurosis|papill|augenärztlich/i,
  },
  followups_recommended: {
    key: "followups_recommended",
    label: "Follow-ups recommended at discharge",
    guidance: "Every follow-up, control or check recommended in discharge letters or consults, with the source date.",
    terms: /empfohlen|kontrolle|nächste|geplant|sollten|hausarzt|in \d+ monaten/i,
  },
  followups_done: {
    key: "followups_done",
    label: "Evidence that follow-ups took place",
    guidance:
      "For each recommended follow-up, check every later document for a record that it took place. If none records it, return not_documented with a note that names the follow-up and says that none of the documents records it.",
    terms: /kontrolle|duplex|sonograph|augen/i,
  },
  lab_values: {
    key: "lab_values",
    label: "Laboratory values",
    guidance: "Any documented laboratory values with dates (lab tables without values do not count).",
    terms: /labor|hba1c|wert|entzünd/i,
  },
  mobility_cognition: {
    key: "mobility_cognition",
    label: "General condition, cognition, social situation",
    guidance: "General condition (AZ), cognition scores such as MMSE, family support.",
    terms: /\bAZ\b|allgemeinzustand|MMSE|familie|kooperativ/i,
  },
  bone_health: {
    key: "bone_health",
    label: "Bone health (osteoporosis, vitamin D)",
    guidance: "Osteoporosis, vitamin D deficiency and their treatment.",
    terms: /osteopor|vitamin|alendron|oleovit/i,
  },
};

export type SectionTemplate = { id: string; title: string; items: string[] };

/** Base needs of each role, used for every situation of that role. */
export const ROLE_PROFILES: Record<string, SectionTemplate[]> = {
  Anaesthetist: [
    { id: "safety", title: "Safety alerts", items: ["allergies", "antithrombotics"] },
    { id: "cardio", title: "Cardiovascular and airway", items: ["cardiac_function", "blood_pressure", "airway_osa", "vascular_findings"] },
    { id: "metabolic", title: "Metabolic and renal", items: ["glucose_lowering", "renal_function", "weight_trend"] },
    { id: "context", title: "Procedure and comorbidities", items: ["planned_procedure", "comorbidities", "demographics"] },
  ],
  "Breast surgeon": [
    { id: "tumour", title: "Tumour", items: ["tumour_histology", "tumour_receptors", "tumour_imaging"] },
    { id: "plan", title: "Plan", items: ["tumour_board", "planned_procedure"] },
    { id: "safety", title: "Peri-operative safety", items: ["allergies", "antithrombotics", "comorbidities"] },
  ],
  "General practitioner": [
    { id: "meds", title: "Medication", items: ["current_medication", "medication_changes"] },
    { id: "chronic", title: "Chronic conditions", items: ["diabetes_control", "blood_pressure", "weight_trend", "comorbidities"] },
    { id: "followup", title: "Follow-ups", items: ["followups_recommended", "followups_done"] },
    { id: "safety", title: "Safety", items: ["allergies", "renal_function"] },
  ],
  "Emergency physician": [
    { id: "safety", title: "Safety alerts", items: ["allergies", "antithrombotics", "contrast_safety"] },
    { id: "history", title: "Relevant history", items: ["prior_events", "vascular_findings", "comorbidities"] },
    { id: "meds", title: "Medication", items: ["antihypertensives", "current_medication"] },
    { id: "vitals", title: "Baseline", items: ["blood_pressure", "cardiac_function", "renal_function", "demographics"] },
  ],
  "Clinical pharmacist": [
    { id: "meds", title: "Medication", items: ["current_medication", "medication_changes", "antithrombotics", "glucose_lowering"] },
    { id: "safety", title: "Safety", items: ["allergies", "renal_function", "comorbidities"] },
    { id: "monitor", title: "Monitoring", items: ["diabetes_control", "blood_pressure", "weight_trend"] },
  ],
  Oncologist: [
    { id: "tumour", title: "Tumour", items: ["tumour_histology", "tumour_receptors", "tumour_imaging"] },
    { id: "plan", title: "Plan", items: ["tumour_board", "planned_procedure"] },
    { id: "fitness", title: "Fitness for therapy", items: ["cardiac_function", "comorbidities", "current_medication", "allergies", "mobility_cognition"] },
  ],
  "Ward nurse": [
    { id: "safety", title: "Safety alerts", items: ["allergies", "antithrombotics"] },
    { id: "care", title: "Care", items: ["current_medication", "glucose_lowering", "planned_procedure", "mobility_cognition"] },
    { id: "vitals", title: "Baseline vitals", items: ["blood_pressure", "weight_trend"] },
  ],
  Radiologist: [
    { id: "safety", title: "Contrast safety", items: ["contrast_safety", "allergies", "renal_function"] },
    { id: "imaging", title: "Prior imaging", items: ["tumour_imaging", "vascular_findings"] },
    { id: "context", title: "Clinical context", items: ["tumour_histology", "planned_procedure", "comorbidities"] },
  ],
};

const DEFAULT_PROFILE: SectionTemplate[] = [
  { id: "safety", title: "Safety alerts", items: ["allergies", "antithrombotics"] },
  { id: "meds", title: "Medication", items: ["current_medication"] },
  { id: "history", title: "Diagnoses", items: ["comorbidities"] },
];

/** Situation templates add or prioritise categories when their trigger matches the situation text. */
export const SITUATION_TEMPLATES: { id: string; trigger: RegExp; sections: SectionTemplate[]; excludeRoles?: string[] }[] = [
  {
    id: "preop",
    trigger: /pre-?op|anaesth|anesth|surgery|operation|procedure|scheduled for/i,
    sections: [
      { id: "safety", title: "Safety alerts", items: ["allergies", "antithrombotics"] },
      { id: "cardio", title: "Cardiovascular and airway", items: ["cardiac_function", "blood_pressure", "airway_osa"] },
      { id: "metabolic", title: "Metabolic and renal", items: ["glucose_lowering", "renal_function", "weight_trend"] },
      { id: "context", title: "Procedure", items: ["planned_procedure", "demographics"] },
    ],
  },
  {
    id: "tumour",
    // Mentioning the operation site ("removal of the breast") is not a reason to show tumour biology.
    trigger: /tumou?r|cancer|carcinoma|oncolog|histolog|biopsy|receptor|staging/i,
    // Tumour biology does not change these roles' decisions (e.g. receptor status for anaesthesia).
    excludeRoles: ["Anaesthetist", "Emergency physician", "Ward nurse", "Clinical pharmacist"],
    sections: [
      { id: "tumour", title: "Tumour", items: ["tumour_histology", "tumour_receptors", "tumour_imaging"] },
      { id: "plan", title: "Plan", items: ["tumour_board", "planned_procedure"] },
    ],
  },
  {
    id: "diabetes",
    trigger: /diabet|glucose|hba1c|metabolic|weight/i,
    sections: [
      { id: "diabetes", title: "Diabetes", items: ["glucose_lowering", "diabetes_control", "weight_trend", "renal_function"] },
    ],
  },
  {
    id: "emergency",
    trigger: /emergency|night|dizz|vision|stroke|syncope|chest pain|arrives/i,
    sections: [
      { id: "safety", title: "Safety alerts", items: ["allergies", "contrast_safety", "antithrombotics"] },
      { id: "history", title: "Has this happened before?", items: ["prior_events", "vascular_findings", "eye_findings"] },
      { id: "meds", title: "Medication", items: ["antihypertensives", "current_medication"] },
    ],
  },
  {
    id: "contrast",
    trigger: /contrast|\bCT\b|angiograph|imaging/i,
    sections: [{ id: "safety", title: "Safety alerts", items: ["contrast_safety", "allergies", "renal_function"] }],
  },
  {
    id: "followup",
    trigger: /follow-?up|open items|still open|recommended|discharge/i,
    sections: [
      { id: "followup", title: "Follow-ups", items: ["followups_recommended", "followups_done", "vascular_findings", "eye_findings"] },
    ],
  },
  {
    id: "medication",
    trigger: /medication|drug|pharmac|reconcil|interaction|prescri/i,
    sections: [{ id: "meds", title: "Medication", items: ["current_medication", "medication_changes", "allergies", "renal_function"] }],
  },
];

export function profileForRole(role: string): SectionTemplate[] {
  const exact = ROLE_PROFILES[role];
  if (exact) return exact;
  const loose = Object.keys(ROLE_PROFILES).find((r) => role.toLowerCase().includes(r.toLowerCase().split(" ").at(-1)!));
  return loose ? ROLE_PROFILES[loose] : DEFAULT_PROFILE;
}

export type PlannedItem = { key: string; label: string; guidance: string };
export type PlannedSection = { id: string; title: string; items: PlannedItem[] };

/**
 * Combine the situation's needs (first) with the role's base needs (after),
 * without duplicates. Sections with the same id are merged.
 */
export function deterministicPlan(roles: string[], situationText: string): PlannedSection[] {
  const sections: SectionTemplate[] = [];
  const add = (tpl: SectionTemplate) => {
    const existing = sections.find((s) => s.id === tpl.id);
    if (existing) existing.items.push(...tpl.items.filter((i) => !existing.items.includes(i)));
    else sections.push({ ...tpl, items: [...tpl.items] });
  };
  for (const t of SITUATION_TEMPLATES) {
    if (!t.trigger.test(situationText)) continue;
    if (t.excludeRoles && roles.every((r) => t.excludeRoles!.includes(r))) continue;
    t.sections.forEach(add);
  }
  for (const role of roles) profileForRole(role).forEach(add);
  // Each category appears once, in the first section that lists it.
  const seen = new Set<string>();
  return sections
    .map((s) => ({
      id: s.id,
      title: s.title,
      items: s.items
        .filter((k) => !seen.has(k) && seen.add(k) && CATEGORIES[k])
        .map((k) => ({ key: k, label: CATEGORIES[k].label, guidance: CATEGORIES[k].guidance })),
    }))
    .filter((s) => s.items.length > 0);
}
