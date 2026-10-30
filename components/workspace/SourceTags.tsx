"use client";

import { Document } from "@carbon/icons-react";
import { docKindLabel, formatDate } from "@/lib/format";
import type { DocumentMeta, Fact } from "@/lib/types";
import type { OpenSource } from "./types";

export function docLabel(documents: DocumentMeta[], docId: string) {
  const d = documents.find((x) => x.id === docId);
  return d ? `${docKindLabel(d.title, d.type)} · ${formatDate(d.date)}` : `Document ${docId}`;
}

/** One source link per cited document; clicking opens the highlighted passage(s). */
export function SourceTags({
  fact,
  documents,
  onOpenSource,
}: {
  fact: Fact;
  documents: DocumentMeta[];
  onOpenSource: OpenSource;
}) {
  const byDoc = new Map<string, string[]>();
  for (const q of fact.quotes) {
    const docId = q.passageId.split(":")[0];
    byDoc.set(docId, [...(byDoc.get(docId) ?? []), q.passageId]);
  }
  for (const i of fact.calculation?.inputs ?? []) {
    const docId = i.passageId.split(":")[0];
    if (!byDoc.get(docId)?.includes(i.passageId)) byDoc.set(docId, [...(byDoc.get(docId) ?? []), i.passageId]);
  }
  return (
    <span className="source-tags">
      {[...byDoc].map(([docId, ids]) => (
        <button
          key={docId}
          type="button"
          onClick={() => onOpenSource(docId, ids, fact.statement)}
          className="source-tag"
          aria-label={`Open source: ${docLabel(documents, docId)}`}
        >
          <Document size={12} aria-hidden />
          {docLabel(documents, docId)}
        </button>
      ))}
      {fact.kind === "calculated" && (
        <span className="source-tags__calc" title="Calculated from the linked source values">
          calculated
        </span>
      )}
    </span>
  );
}
