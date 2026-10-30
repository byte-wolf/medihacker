"use client";

import { OperationalTag, Tag } from "@carbon/react";
import { Document, WarningAlt } from "@carbon/icons-react";
import { docKindLabel, formatDate } from "@/lib/format";
import type { DocumentMeta, Fact } from "@/lib/types";
import type { OpenSource } from "./types";

export function docLabel(documents: DocumentMeta[], docId: string) {
  const d = documents.find((x) => x.id === docId);
  return d ? `${docKindLabel(d.title, d.type)} · ${formatDate(d.date)}` : `Document ${docId}`;
}

/** One clickable source tag per cited document; clicking opens the highlighted passage(s). */
export function SourceTags({
  fact,
  documents,
  onOpenSource,
  contradictionTitles,
  onShowContradiction,
}: {
  fact: Fact;
  documents: DocumentMeta[];
  onOpenSource: OpenSource;
  contradictionTitles: Record<string, string>;
  onShowContradiction: (id: string) => void;
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
        <OperationalTag
          key={docId}
          type="blue"
          size="sm"
          renderIcon={Document}
          onClick={() => onOpenSource(docId, ids, fact.statement)}
          className="source-tag"
          text={docLabel(documents, docId)}
          aria-label={`Open source: ${docLabel(documents, docId)}`}
        />
      ))}
      {fact.kind === "calculated" && (
        <Tag type="purple" size="sm" title="Calculated from the linked source values">
          Calculated
        </Tag>
      )}
      {(fact.contradictionIds ?? []).map((id) => (
        <button
          key={id}
          type="button"
          className="contradiction-badge"
          onClick={() => onShowContradiction(id)}
          aria-label={`Contradiction: ${contradictionTitles[id] ?? "documents disagree"}. Show details`}
        >
          <WarningAlt size={14} aria-hidden />
          <span>
            <strong>Contradiction:</strong> {contradictionTitles[id] ?? "documents disagree"}
          </span>
        </button>
      ))}
    </span>
  );
}
