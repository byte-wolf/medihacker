// Documents a user can create. One for the demo.
export const DOCUMENT_TYPES = [
  {
    id: "preop-anesthesia",
    title: "Preoperative Anesthesia Checklist",
    description: "Pre-filled from the record: confirm identity and allergies, review medication and history, enter the examination, get the ASA class.",
  },
] as const;

export type DocumentTypeId = (typeof DOCUMENT_TYPES)[number]["id"];

export const isDocumentType = (id: unknown): id is DocumentTypeId => DOCUMENT_TYPES.some((t) => t.id === id);
