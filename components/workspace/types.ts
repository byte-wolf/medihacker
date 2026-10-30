import type { BriefingItem, BriefingSection, Contradiction, DocumentMeta, RejectedFact, TokenCall } from "@/lib/types";

export type WorkspacePatient = {
  id: string;
  name: string;
  sex: string;
  dateOfBirth: string;
  age: number;
  latestDocumentDate: string;
  documents: DocumentMeta[];
  allergies: { passageId: string; text: string }[];
};

export type SituationOption = {
  id: number;
  title: string;
  description: string;
  role: string | null;
  suggestedQuestions: string[];
  /** mine = created by the user, assigned = preset linked to the user, preset = other presets */
  group: "mine" | "assigned" | "preset";
};

export type PlanSection = { id: string; title: string; items: { key: string; label: string }[] };

export type BriefingState = {
  status: "idle" | "loading" | "done" | "error";
  plan: PlanSection[];
  sections: Record<string, BriefingSection>;
  sectionErrors: Record<string, string>;
  contradictions: Contradiction[];
  relevantContradictions: string[];
  rejected: RejectedFact[];
  tokenCalls?: TokenCall[];
  tokens?: number;
  error?: string;
  ms?: number;
  cached?: boolean;
  fallback?: boolean;
};

export type ChatMessage =
  | { id: number | string; role: "user"; text: string }
  | { id: number | string; role: "assistant"; items: BriefingItem[]; latencyMs?: number | null }
  | { id: number | string; role: "pending" }
  | { id: number | string; role: "error"; text: string };

/** Open a source: a document and the passages to highlight in it. */
export type OpenSource = (docId: string, passageIds: string[], context?: string) => void;
