"use client";

import {
  Button,
  Checkbox,
  IconButton,
  InlineNotification,
  Layer,
  OperationalTag,
  Popover,
  PopoverContent,
  Select,
  SelectItem,
  Tag,
  TextArea,
  TextInput,
} from "@carbon/react";
import {
  Add,
  Checkmark,
  CheckmarkFilled,
  ChevronDown,
  ChevronUp,
  Document,
  Information,
  Locked,
  Save,
  TrashCan,
} from "@carbon/icons-react";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ASA_CLASSES,
  DENTAL_OPTIONS,
  MALLAMPATI,
  bmiOf,
  saveBlockers,
  suggestAsa,
  type AllergyEntry,
  type Checklist,
  type ConditionEntry,
  type MedicationEntry,
  type SurgeryEntry,
  uncodedDiagnoses,
} from "@/lib/documents/anesthesia";
import { formatDate } from "@/lib/format";
import type { DocumentMeta } from "@/lib/types";
import { SourcePanel } from "@/components/workspace/SourcePanel";

type Props = { patientId: string; prefill: Checklist; docLabels: Record<string, string>; documents: DocumentMeta[]; backHref: string };
type OpenSource = { docId: string; passageIds: string[]; context?: string };
type SourceLink = { docId: string; label: string; passageIds: string[] };

/** Diagnoses shown before the list is expanded. */
const HISTORY_PREVIEW = 5;
const ICD10 = /^[A-Z]\d{2}(\.\d{1,2})?$/;

const newId = () => `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function AnesthesiaChecklist({ patientId, prefill, docLabels, documents, backHref }: Props) {
  // Every filled-in form gets its own id; the server stores each id only once.
  const fresh = () => ({ ...prefill, formId: crypto.randomUUID() });
  const [c, setC] = useState<Checklist>(fresh);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saved, setSaved] = useState<{ id: number; at: string } | null>(null);
  const [openSource, setOpenSource] = useState<OpenSource | null>(null);
  const [error, setError] = useState<{ message: string; blockers: string[] } | null>(null);

  const asa = useMemo(() => suggestAsa(c), [c]);
  const blockers = saveBlockers(c);
  const bmi = bmiOf(c.exam.heightCm, c.exam.weightKg);

  const update = (fn: (draft: Checklist) => Checklist) => {
    setC(fn);
    setSaved(null);
  };
  const [historyExpanded, setHistoryExpanded] = useState(false);
  // Once the full list has been opened, the confirmations stay available (also after "Show fewer").
  const [historySeen, setHistorySeen] = useState(false);
  const historySeenAll = historySeen || c.conditions.length <= HISTORY_PREVIEW;
  const uncoded = uncodedDiagnoses(c);
  const setConfirmed = (key: keyof Checklist["confirmations"], value: boolean) =>
    update((d) => ({ ...d, confirmations: { ...d.confirmations, [key]: value } }));
  const setConditionIcd = (id: string, code: string) =>
    update((d) => ({
      ...d,
      conditions: d.conditions.map((x) => (x.id === id ? { ...x, icd: [code] } : x)),
      confirmations: { ...d.confirmations, diagnoses: false },
    }));
  const setExam = <K extends keyof Checklist["exam"]>(key: K, value: Checklist["exam"][K]) =>
    update((d) => ({ ...d, exam: { ...d.exam, [key]: value } }));

  const source = (e: { origin: string; date: string; docIds: string[] }) => {
    if (e.origin === "manual") return "Added by you";
    const docs = e.docIds.map((id) => docLabels[id]).filter(Boolean);
    return docs.length ? `Source: ${docs.join(", ")}` : "Source: structured record";
  };

  const sourceLinks = (e: { origin: string; docIds: string[]; passageIds: string[] }): SourceLink[] =>
    e.origin === "manual"
      ? []
      : e.docIds
          .filter((id) => docLabels[id])
          .map((docId) => ({ docId, label: docLabels[docId], passageIds: e.passageIds.filter((p) => p.startsWith(`${docId}:`)) }));

  const save = async () => {
    // A ref, not state: two clicks in the same frame must not send the form twice.
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/patient-documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patientId, type: "preop-anesthesia", content: c }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError({ message: data?.error ?? "Could not save the document.", blockers: data?.blockers ?? [] });
        return;
      }
      // Saved: clear the form so the same checklist cannot be saved again.
      setC(fresh());
      setHistoryExpanded(false);
      setHistorySeen(false);
      setOpenSource(null);
      setSaved({ id: data.document.id, at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className={`workspace__grid doc-page__grid${openSource ? " workspace__grid--source" : ""}`}>
      <div className="workspace__main">
        <form
          className="checklist"
          aria-labelledby="checklist-title"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <header className="checklist__head">
            <h1 id="checklist-title" className="page-title">
              Preoperative Anesthesia Checklist
            </h1>
            <p className="muted">
              Pre-filled from the record. Check every value, correct or add what is missing. Values marked with a source come from the
              documents named; nothing here was generated by AI.
            </p>
            {saved && (
              <InlineNotification
                kind="success"
                title="Document saved"
                subtitle={`Saved at ${saved.at} (no. ${saved.id}). The form has been cleared for a new checklist.`}
                lowContrast
                onClose={() => setSaved(null)}
              />
            )}
          </header>

          {/* Keyed by form: clearing after a save also resets the inputs' own state. */}
          <div key={c.formId} className="checklist__sections">
            {/* A ------------------------------------------------------------ */}
            <Section letter="A" title="Patient identity" done={c.identity.confirmed} doneText="Confirmed" todoText="Confirm">
              <dl className="checklist__identity">
                <div>
                  <dt>Name</dt>
                  <dd>{c.identity.name}</dd>
                </div>
                <div>
                  <dt>Date of birth</dt>
                  <dd>{formatDate(c.identity.dateOfBirth)}</dd>
                </div>
                <div>
                  <dt>Sex</dt>
                  <dd>{c.identity.sex}</dd>
                </div>
                <div>
                  <dt>Patient ID</dt>
                  <dd className="checklist__mono">{c.identity.patientId}</dd>
                </div>
              </dl>
              <Checkbox
                id="identity-confirmed"
                labelText="I confirmed name and date of birth with the patient (or wristband)."
                checked={c.identity.confirmed}
                onChange={(_, { checked }) => update((d) => ({ ...d, identity: { ...d.identity, confirmed: checked } }))}
              />
            </Section>

            {/* B ------------------------------------------------------------ */}
            <Section
              letter="B"
              title="Allergies"
              done={c.allergies.confirmed}
              doneText="Confirmed"
              todoText="Confirm"
              critical={c.allergies.entries.length > 0}
            >
              <EntryList<AllergyEntry>
                label="allergy"
                entries={c.allergies.entries}
                empty="No allergies documented."
                render={(e) => (
                  <>
                    <span className="checklist__entry-main">{e.text}</span>
                    <span className="checklist__entry-meta">{source(e)}</span>
                  </>
                )}
                onRemove={(id) =>
                  update((d) => ({ ...d, allergies: { entries: d.allergies.entries.filter((x) => x.id !== id), confirmed: false } }))
                }
              />
              <AddRow
                id="allergy-add"
                label="Add allergy"
                placeholder="e.g. Penicillin (rash)"
                onAdd={(text) =>
                  update((d) => ({
                    ...d,
                    allergies: {
                      entries: [...d.allergies.entries, { id: newId(), origin: "manual", text, date: "", docIds: [], passageIds: [] }],
                      confirmed: false,
                    },
                  }))
                }
              />
              <Checkbox
                id="allergies-confirmed"
                labelText={
                  c.allergies.entries.length
                    ? "I checked these allergies with the patient. The list is complete."
                    : "I asked the patient: no known allergies."
                }
                checked={c.allergies.confirmed}
                onChange={(_, { checked }) => update((d) => ({ ...d, allergies: { ...d.allergies, confirmed: checked } }))}
              />
            </Section>

            {/* C ------------------------------------------------------------ */}
            <Section
              letter="C"
              title="Current medication"
              done={c.confirmations.medication}
              doneText="Confirmed"
              todoText="Confirm"
              info={`${c.medication.length} from the record`}
            >
              <EntryList<MedicationEntry>
                label="medication"
                entries={c.medication}
                empty="No medication documented."
                render={(e) => (
                  <span className="checklist__entry-main">
                    <strong>{e.drug}</strong> <span className="checklist__mono">{e.dosage}</span>
                    <InfoTip label={`Documentation of ${e.drug}`} links={sourceLinks(e)} context={e.drug} onOpen={setOpenSource}>
                      {e.date ? <span className="info-tip__line">{`Last documented ${formatDate(e.date)}`}</span> : null}
                      {e.origin === "manual" && <span className="info-tip__line">Added by you</span>}
                    </InfoTip>
                  </span>
                )}
                onRemove={(id) =>
                  update((d) => ({
                    ...d,
                    medication: d.medication.filter((x) => x.id !== id),
                    confirmations: { ...d.confirmations, medication: false },
                  }))
                }
              />
              <AddRow
                id="medication-add"
                label="Add medication"
                placeholder="e.g. Bisoprolol 2.5 mg 1-0-0"
                onAdd={(text) =>
                  update((d) => ({
                    ...d,
                    medication: [
                      ...d.medication,
                      { id: newId(), origin: "manual", drug: text, dosage: "", date: "", docIds: [], passageIds: [] },
                    ],
                    confirmations: { ...d.confirmations, medication: false },
                  }))
                }
              />
              <ConfirmAction
                id="confirm-medication"
                label="Confirm current medication"
                doneText="Current medication confirmed"
                confirmed={c.confirmations.medication}
                onChange={(v) => setConfirmed("medication", v)}
              />
            </Section>

            {/* D ------------------------------------------------------------ */}
            <Section
              letter="D"
              title="Medical history (anamnesis)"
              done={c.confirmations.diagnoses && c.confirmations.history}
              doneText="Confirmed"
              todoText="Confirm"
            >
              <h3 className="checklist__sub">Previous conditions (ICD-10)</h3>
              <EntryList<ConditionEntry>
                label="condition"
                listId="conditions-list"
                entries={historyExpanded ? c.conditions : c.conditions.slice(0, HISTORY_PREVIEW)}
                revealedFrom={HISTORY_PREVIEW}
                empty="No conditions documented."
                render={(e) => (
                  <>
                    <span className="checklist__entry-main">
                      {e.icd.map((code) => (
                        <Tag key={code} size="sm" type="blue" className="checklist__icd" title={`ICD-10 ${code}`}>
                          {code}
                        </Tag>
                      ))}
                      {e.label}
                      {e.status === "suspected" && (
                        <Tag size="sm" type="warm-gray">
                          suspected
                        </Tag>
                      )}
                      {e.status === "statuspost" && (
                        <Tag size="sm" type="cool-gray">
                          status post
                        </Tag>
                      )}
                      <InfoTip label={`Details of ${e.label}`} links={sourceLinks(e)} context={e.label} onOpen={setOpenSource}>
                        {e.detail && <span className="info-tip__line">{e.detail}</span>}
                        {e.date && <span className="info-tip__line">{formatDate(e.date)}</span>}
                        {e.origin === "manual" && <span className="info-tip__line">Added by you</span>}
                      </InfoTip>
                    </span>
                    {!e.icd.length && <IcdInput id={`icd-${e.id}`} onSet={(code) => setConditionIcd(e.id, code)} />}
                  </>
                )}
                onRemove={(id) =>
                  update((d) => ({
                    ...d,
                    conditions: d.conditions.filter((x) => x.id !== id),
                    confirmations: { ...d.confirmations, diagnoses: false, history: false },
                  }))
                }
              />
              {c.conditions.length > HISTORY_PREVIEW && (
                <Button
                  kind="ghost"
                  size="sm"
                  className="checklist__expand"
                  renderIcon={historyExpanded ? ChevronUp : ChevronDown}
                  aria-expanded={historyExpanded}
                  aria-controls="conditions-list"
                  onClick={() => {
                    setHistoryExpanded((x) => !x);
                    setHistorySeen(true);
                  }}
                >
                  {historyExpanded
                    ? "Show fewer"
                    : `Show all ${c.conditions.length} diagnoses (${c.conditions.length - HISTORY_PREVIEW} more)`}
                </Button>
              )}
              <AddRow
                id="condition-add"
                label="Add condition"
                placeholder="e.g. COPD GOLD 2"
                onAdd={(text) =>
                  update((d) => ({
                    ...d,
                    conditions: [
                      ...d.conditions,
                      {
                        id: newId(),
                        origin: "manual",
                        label: text,
                        detail: "",
                        status: "positive",
                        icd: [],
                        date: "",
                        docIds: [],
                        passageIds: [],
                      },
                    ],
                    confirmations: { ...d.confirmations, diagnoses: false, history: false },
                  }))
                }
              />
              <ConfirmAction
                id="confirm-diagnoses"
                label="Confirm diagnoses and ICD codes"
                doneText="Diagnoses and ICD codes confirmed"
                confirmed={c.confirmations.diagnoses}
                disabledReason={
                  !historySeenAll
                    ? `Show all ${c.conditions.length} diagnoses before confirming.`
                    : uncoded.length
                      ? `Add an ICD-10 code to ${uncoded.length === 1 ? "1 diagnosis" : `${uncoded.length} diagnoses`} first.`
                      : undefined
                }
                onChange={(v) => setConfirmed("diagnoses", v)}
              />

              <h3 className="checklist__sub">Previous surgery</h3>
              <EntryList<SurgeryEntry>
                label="procedure"
                entries={c.surgeries}
                empty="No previous surgery documented."
                render={(e) => (
                  <>
                    <span className="checklist__entry-main">{e.label}</span>
                    <span className="checklist__entry-meta">
                      {e.date ? `${formatDate(e.date)} · ` : ""}
                      {source(e)}
                    </span>
                  </>
                )}
                onRemove={(id) =>
                  update((d) => ({
                    ...d,
                    surgeries: d.surgeries.filter((x) => x.id !== id),
                    confirmations: { ...d.confirmations, history: false },
                  }))
                }
              />
              <AddRow
                id="surgery-add"
                label="Add surgery"
                placeholder="e.g. Appendectomy 1998, no anaesthesia problems"
                onAdd={(text) =>
                  update((d) => ({
                    ...d,
                    surgeries: [...d.surgeries, { id: newId(), origin: "manual", label: text, date: "", docIds: [], passageIds: [] }],
                    confirmations: { ...d.confirmations, history: false },
                  }))
                }
              />
              <ConfirmAction
                id="confirm-history"
                label="Confirm medical history"
                doneText="Medical history confirmed"
                confirmed={c.confirmations.history}
                disabledReason={!historySeenAll ? `Show all ${c.conditions.length} diagnoses before confirming.` : undefined}
                onChange={(v) => setConfirmed("history", v)}
              />
            </Section>

            {/* E ------------------------------------------------------------ */}
            <Section letter="E" title="Examination">
              <fieldset className="checklist__fieldset">
                <legend className="checklist__sub">Dental status</legend>
                <div className="checklist__checks">
                  {DENTAL_OPTIONS.map((o) => (
                    <Checkbox
                      key={o}
                      id={`dental-${o}`}
                      labelText={o}
                      checked={c.exam.dental.includes(o)}
                      onChange={(_, { checked }) =>
                        setExam("dental", checked ? [...c.exam.dental, o] : c.exam.dental.filter((x) => x !== o))
                      }
                    />
                  ))}
                </div>
                <TextInput
                  id="dental-notes"
                  labelText="Dental notes"
                  placeholder="e.g. loose incisor 21"
                  value={c.exam.dentalNotes}
                  onChange={(e) => setExam("dentalNotes", e.target.value)}
                />
              </fieldset>

              <div className="checklist__grid">
                <TextInput
                  id="bp-sys"
                  labelText="Blood pressure systolic (mmHg)"
                  inputMode="numeric"
                  value={c.exam.bpSystolic}
                  onChange={(e) => setExam("bpSystolic", e.target.value)}
                />
                <TextInput
                  id="bp-dia"
                  labelText="Blood pressure diastolic (mmHg)"
                  inputMode="numeric"
                  value={c.exam.bpDiastolic}
                  onChange={(e) => setExam("bpDiastolic", e.target.value)}
                />
                <TextInput
                  id="temperature"
                  labelText="Temperature (°C)"
                  inputMode="decimal"
                  value={c.exam.temperature}
                  onChange={(e) => setExam("temperature", e.target.value)}
                />
                <Select
                  id="mallampati"
                  labelText="Mallampati score"
                  value={c.exam.mallampati}
                  onChange={(e) => setExam("mallampati", e.target.value)}
                >
                  <SelectItem value="" text="Select" />
                  {MALLAMPATI.map((m) => (
                    <SelectItem key={m} value={m} text={`Class ${m}`} />
                  ))}
                </Select>
              </div>

              <div className="checklist__grid">
                <TextInput
                  id="height"
                  labelText="Height (cm)"
                  inputMode="decimal"
                  value={c.exam.heightCm}
                  onChange={(e) => setExam("heightCm", e.target.value)}
                  helperText={
                    c.record.height
                      ? `Pre-filled · ${formatDate(c.record.height.date)} · ${source({ origin: "record", ...c.record.height })}`
                      : "Not documented"
                  }
                />
                <TextInput
                  id="weight"
                  labelText="Weight (kg)"
                  inputMode="decimal"
                  value={c.exam.weightKg}
                  onChange={(e) => setExam("weightKg", e.target.value)}
                  helperText={
                    c.record.weight
                      ? `Pre-filled · ${formatDate(c.record.weight.date)} · ${source({ origin: "record", ...c.record.weight })}`
                      : "Not documented"
                  }
                />
                <div className="checklist__bmi" aria-live="polite">
                  <span className="cds--label">BMI (kg/m²)</span>
                  <span className="checklist__bmi-value">{bmi ?? "–"}</span>
                  <span className="cds--form__helper-text">
                    Calculated from height and weight
                    {c.record.bmi ? ` · documented ${c.record.bmi.value} (${formatDate(c.record.bmi.date)})` : ""}
                  </span>
                </div>
              </div>

              <div className="checklist__grid">
                <Select
                  id="smoking"
                  labelText="Smoking"
                  value={c.exam.smoking}
                  onChange={(e) => setExam("smoking", e.target.value as Checklist["exam"]["smoking"])}
                >
                  <SelectItem value="" text="Select" />
                  <SelectItem value="never" text="Never smoked" />
                  <SelectItem value="former" text="Former smoker" />
                  <SelectItem value="current" text="Current smoker" />
                </Select>
                <TextInput
                  id="pack-years"
                  labelText="Pack-years"
                  inputMode="decimal"
                  value={c.exam.packYears}
                  disabled={c.exam.smoking === "never" || !c.exam.smoking}
                  onChange={(e) => setExam("packYears", e.target.value)}
                />
                <Select
                  id="alcohol"
                  labelText="Alcohol"
                  value={c.exam.alcohol}
                  onChange={(e) => setExam("alcohol", e.target.value as Checklist["exam"]["alcohol"])}
                >
                  <SelectItem value="" text="Select" />
                  <SelectItem value="none" text="None" />
                  <SelectItem value="occasional" text="Occasional (social)" />
                  <SelectItem value="regular" text="Regular" />
                  <SelectItem value="dependence" text="Dependence or abuse" />
                </Select>
                <TextInput
                  id="alcohol-notes"
                  labelText="Alcohol notes"
                  placeholder="e.g. 2 glasses of wine per week"
                  value={c.exam.alcoholNotes}
                  onChange={(e) => setExam("alcoholNotes", e.target.value)}
                />
              </div>
            </Section>

            {/* F ------------------------------------------------------------ */}
            <Section
              letter="F"
              title="ASA score"
              done={!!c.asa.finalClass}
              doneText={`ASA ${c.asa.finalClass}${c.asa.emergency ? "E" : ""}`}
              todoText="Confirm"
            >
              {asa.status === "incomplete" ? (
                <p className="checklist__asa-missing">
                  The ASA class appears when these fields are filled: <strong>{asa.missing.join(", ")}</strong>.
                </p>
              ) : (
                <div className="checklist__asa" aria-live="polite">
                  <div className="checklist__asa-score">
                    <span className="checklist__asa-label">Calculated</span>
                    <span className="checklist__asa-value">ASA {asa.asaClass}</span>
                  </div>
                  <ul className="checklist__asa-reasons">
                    {asa.reasons.map((r) => (
                      <li key={r.text}>
                        <Tag size="sm" type={r.asaClass === "I" ? "green" : r.asaClass === "II" ? "teal" : "red"}>
                          {r.asaClass}
                        </Tag>
                        {r.text}
                      </li>
                    ))}
                  </ul>
                  <p className="checklist__note">
                    Rule-based from the entered data (ASA classification examples). Suspected diagnoses are not counted.
                  </p>
                  <div className="checklist__grid">
                    <Select
                      id="asa-final"
                      labelText="ASA class (your decision)"
                      value={c.asa.finalClass}
                      onChange={(e) =>
                        update((d) => ({ ...d, asa: { ...d.asa, finalClass: e.target.value as Checklist["asa"]["finalClass"] } }))
                      }
                    >
                      <SelectItem value="" text="Select" />
                      {ASA_CLASSES.map((k) => (
                        <SelectItem key={k} value={k} text={k === asa.asaClass ? `ASA ${k} (calculated)` : `ASA ${k}`} />
                      ))}
                    </Select>
                    <div className="checklist__asa-actions">
                      <Button
                        kind="tertiary"
                        size="md"
                        onClick={() => update((d) => ({ ...d, asa: { ...d.asa, finalClass: asa.asaClass } }))}
                        disabled={c.asa.finalClass === asa.asaClass}
                      >
                        Accept ASA {asa.asaClass}
                      </Button>
                      <Checkbox
                        id="asa-emergency"
                        labelText="Emergency (E)"
                        checked={c.asa.emergency}
                        onChange={(_, { checked }) => update((d) => ({ ...d, asa: { ...d.asa, emergency: checked } }))}
                      />
                    </div>
                  </div>
                  {c.asa.finalClass && c.asa.finalClass !== asa.asaClass && (
                    <TextArea
                      id="asa-note"
                      labelText="Why does your class differ from the calculated one?"
                      rows={2}
                      value={c.asa.note}
                      onChange={(e) => update((d) => ({ ...d, asa: { ...d.asa, note: e.target.value } }))}
                    />
                  )}
                </div>
              )}
            </Section>
          </div>

          <footer className="checklist__footer">
            {error && (
              <InlineNotification
                kind="error"
                title={error.message}
                subtitle={error.blockers.join(" ")}
                lowContrast
                onClose={() => setError(null)}
              />
            )}
            {blockers.length > 0 && (
              <ul className="checklist__blockers" aria-label="Still to do before saving">
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            <div className="checklist__footer-actions">
              <Button kind="ghost" href={backHref}>
                Back to patient
              </Button>
              <Button type="submit" renderIcon={Save} disabled={saving || blockers.length > 0}>
                {saving ? "Saving…" : "Save Document"}
              </Button>
            </div>
          </footer>
        </form>
      </div>
      {openSource && (
        <aside className="workspace__rail" aria-label="Source document">
          <SourcePanel
            key={`${openSource.docId}:${openSource.passageIds.join(",")}`}
            patientId={patientId}
            docId={openSource.docId}
            passageIds={openSource.passageIds}
            context={openSource.context}
            documents={documents}
            onClose={() => setOpenSource(null)}
            onNavigate={(docId, passageIds) => setOpenSource({ docId, passageIds })}
          />
        </aside>
      )}
    </div>
  );
}

function Section(props: {
  letter: string;
  title: string;
  children: ReactNode;
  done?: boolean;
  doneText?: string;
  todoText?: string;
  info?: string;
  critical?: boolean;
}) {
  const id = `section-${props.letter}`;
  return (
    <section className={`checklist__section${props.critical ? " checklist__section--critical" : ""}`} aria-labelledby={id}>
      <h2 id={id} className="checklist__title">
        <span className="checklist__letter" aria-hidden>
          {props.letter}
        </span>
        {props.title}
        {props.done !== undefined && (
          <Tag size="sm" type={props.done ? "green" : "warm-gray"}>
            {props.done ? props.doneText : props.todoText}
          </Tag>
        )}
        {props.info && <span className="checklist__info">{props.info}</span>}
      </h2>
      <Layer className="checklist__body">{props.children}</Layer>
    </section>
  );
}

function EntryList<T extends { id: string }>(props: {
  label: string;
  listId?: string;
  /** Entries from this index on were revealed by expanding; they fade in. */
  revealedFrom?: number;
  entries: T[];
  empty: string;
  render: (e: T) => ReactNode;
  onRemove: (id: string) => void;
}) {
  if (!props.entries.length) return <p className="muted checklist__empty">{props.empty}</p>;
  return (
    <ul className="checklist__entries" id={props.listId}>
      {props.entries.map((e, i) => (
        <li
          key={e.id}
          className={`checklist__entry${props.revealedFrom !== undefined && i >= props.revealedFrom ? " checklist__entry--revealed" : ""}`}
        >
          <div className="checklist__entry-text">{props.render(e)}</div>
          <IconButton kind="ghost" size="sm" label={`Remove ${props.label}`} align="left" onClick={() => props.onRemove(e.id)}>
            <TrashCan />
          </IconButton>
        </li>
      ))}
    </ul>
  );
}

function AddRow(props: { id: string; label: string; placeholder: string; onAdd: (text: string) => void }) {
  const [text, setText] = useState("");
  const add = () => {
    if (!text.trim()) return;
    props.onAdd(text.trim());
    setText("");
  };
  return (
    <div className="checklist__add">
      <TextInput
        id={props.id}
        labelText={props.label}
        hideLabel
        placeholder={props.placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
      />
      <Button kind="ghost" size="md" renderIcon={Add} onClick={add} disabled={!text.trim()}>
        {props.label}
      </Button>
    </div>
  );
}

/** Confirmation button with a visible, explained disabled state. */
function ConfirmAction(props: {
  id: string;
  label: string;
  doneText: string;
  confirmed: boolean;
  /** Set while the action is not allowed yet; shown under the button. */
  disabledReason?: string;
  onChange: (confirmed: boolean) => void;
}) {
  const hintId = `${props.id}-hint`;
  if (props.confirmed) {
    return (
      <div className="confirm-action confirm-action--done" role="status">
        <CheckmarkFilled size={16} aria-hidden />
        <span>{props.doneText}</span>
        <Button kind="ghost" size="sm" onClick={() => props.onChange(false)}>
          Undo
        </Button>
      </div>
    );
  }
  const disabled = !!props.disabledReason;
  return (
    <div className="confirm-action">
      <Button
        id={props.id}
        kind="tertiary"
        size="md"
        renderIcon={disabled ? Locked : Checkmark}
        disabled={disabled}
        aria-describedby={disabled ? hintId : undefined}
        onClick={() => props.onChange(true)}
      >
        {props.label}
      </Button>
      {disabled && (
        <p id={hintId} className="confirm-action__hint">
          {props.disabledReason}
        </p>
      )}
    </div>
  );
}

/**
 * "i" icon with a hover card (also opens on focus or tap). The card stays open while the
 * pointer is on it, so its source links can be clicked; a link opens the document on the right.
 */
function InfoTip(props: { label: string; children: ReactNode; links: SourceLink[]; context: string; onOpen: (s: OpenSource) => void }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const id = useId();
  const show = () => {
    window.clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = (delay = 150) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), delay);
  };
  return (
    <Popover
      open={open}
      align="bottom-left"
      caret
      dropShadow
      className="info-tip"
      onMouseEnter={show}
      onMouseLeave={() => hide()}
      onFocus={show}
      onBlur={(e: React.FocusEvent<HTMLSpanElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hide(0);
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLSpanElement>) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button type="button" className="info-tip__trigger" aria-label={props.label} aria-expanded={open} aria-controls={id} onClick={show}>
        <Information size={16} aria-hidden />
      </button>
      <PopoverContent id={id} className="info-card">
        <div className="info-card__body">
          {props.children}
          {props.links.length > 0 && (
            <div className="info-card__sources">
              <span className="info-card__label">Source</span>
              {props.links.map((l) => (
                <OperationalTag
                  key={l.docId}
                  type="blue"
                  size="sm"
                  renderIcon={Document}
                  className="source-tag"
                  text={l.label}
                  aria-label={`Open source: ${l.label}`}
                  onClick={() => {
                    setOpen(false);
                    props.onOpen({ docId: l.docId, passageIds: l.passageIds, context: props.context });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Inline ICD-10 entry for a diagnosis the record has no code for. */
function IcdInput({ id, onSet }: { id: string; onSet: (code: string) => void }) {
  const [value, setValue] = useState("");
  const code = value.trim().toUpperCase();
  const valid = ICD10.test(code);
  const commit = () => {
    if (valid) onSet(code);
  };
  return (
    <div className="checklist__icd-input">
      <TextInput
        id={id}
        size="sm"
        labelText="ICD-10 code (not in the record)"
        placeholder="e.g. I10.90"
        value={value}
        invalid={!!value && !valid}
        invalidText="Format: letter, two digits, optional decimals (e.g. I10.90)"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
      />
      <Button kind="ghost" size="sm" onClick={commit} disabled={!valid}>
        Set code
      </Button>
    </div>
  );
}
