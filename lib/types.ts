// Shared domain types used by server and client code.

export type DocumentMeta = {
  id: string;
  title: string;
  date: string; // ISO yyyy-mm-dd as given in documents.json
  type: string;
  department: string;
};

export type SourceDocument = DocumentMeta & {
  /** Decoded document text (HTML entities resolved, <BR> → \n). Passage offsets point into this. */
  text: string;
};

export type Passage = {
  /** Stable id: `${docId}:p${NNN}` */
  id: string;
  docId: string;
  /** Nearest heading above the passage, e.g. "Entlassungsmedikation" */
  section: string | null;
  kind: "heading" | "line" | "sentence";
  text: string;
  start: number;
  end: number;
};

export type PatientSummary = {
  id: string;
  name: string;
  sex: string;
  dateOfBirth: string;
  documentCount: number;
  latestDocumentDate: string;
};

export type FactKind = "documented" | "calculated";

export type Calculation =
  | { type: "difference"; inputs: CalcInput[]; result: number; unit?: string }
  | { type: "bmi"; inputs: CalcInput[]; result: number }
  | { type: "age"; inputs: CalcInput[]; result: number };

export type CalcInput = { passageId: string; value: number; unit?: string; label?: string };

export type Quote = { passageId: string; text: string };

export type Fact = {
  statement: string;
  /** Short display of when it was documented, e.g. "15 Apr 2016" */
  date?: string;
  kind: FactKind;
  quotes: Quote[];
  calculation?: Calculation;
  /** Set by the server when a contradiction touches one of the fact's passages */
  contradictionIds?: string[];
};

export type ItemStatus = "documented" | "not_documented" | "unverified";

export type BriefingItem = {
  key: string;
  label: string;
  status: ItemStatus;
  facts: Fact[];
  /** Explanation for not_documented / unverified */
  note?: string;
};

export type BriefingSection = {
  id: string;
  title: string;
  items: BriefingItem[];
};

export type Contradiction = {
  id: string;
  title: string;
  explanation: string;
  severity: "high" | "medium" | "low";
  categories: string[];
  passageIds: string[];
  detectedBy: "rule" | "llm";
};

export type RejectedFact = { section: string; item: string; statement: string; reason: string };

/** One model call and its token counts (0 when served from cache). */
export type TokenCall = { tag: string; model: string; cached: boolean; prompt: number; completion: number; total: number };

export type BriefingStreamEvent =
  | { type: "plan"; sections: { id: string; title: string; items: { key: string; label: string }[] }[] }
  | { type: "section"; section: BriefingSection }
  | { type: "contradictions"; relevant: string[]; all: Contradiction[] }
  | { type: "debug"; rejected: RejectedFact[] }
  | { type: "error"; message: string; sectionId?: string }
  | { type: "tokens"; calls: TokenCall[]; total: number }
  | { type: "done"; ms: number; cached: boolean; fallback: boolean };
