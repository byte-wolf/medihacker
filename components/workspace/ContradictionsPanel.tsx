"use client";

import { Accordion, AccordionItem, OperationalTag, SkeletonText, Tag } from "@carbon/react";
import { Document, WarningAltFilled } from "@carbon/icons-react";
import { useEffect, useRef } from "react";
import type { Contradiction, DocumentMeta } from "@/lib/types";
import { docLabel } from "./SourceTags";
import type { OpenSource } from "./types";

export function ContradictionCard({
  c,
  documents,
  onOpenSource,
  focused,
}: {
  c: Contradiction;
  documents: DocumentMeta[];
  onOpenSource: OpenSource;
  focused: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focused) {
      ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      ref.current?.focus();
    }
  }, [focused]);
  const byDoc = new Map<string, string[]>();
  for (const id of c.passageIds) {
    const d = id.split(":")[0];
    byDoc.set(d, [...(byDoc.get(d) ?? []), id]);
  }
  return (
    <div ref={ref} tabIndex={-1} className={`contradiction${focused ? " contradiction--focused" : ""}`} data-contradiction={c.id}>
      <div className="contradiction__title">
        <WarningAltFilled size={16} aria-hidden className={`sev-${c.severity}`} />
        <h3>{c.title}</h3>
      </div>
      <p className="contradiction__text">{c.explanation}</p>
      <div className="contradiction__sources">
        {[...byDoc].map(([docId, ids]) => (
          <OperationalTag
            key={docId}
            type="blue"
            size="sm"
            renderIcon={Document}
            text={`${docLabel(documents, docId)}${ids.length > 1 ? ` (${ids.length} passages)` : ""}`}
            onClick={() => onOpenSource(docId, c.passageIds.filter((p) => p.startsWith(docId + ":")), c.title)}
          />
        ))}
        <Tag type={c.severity === "high" ? "red" : c.severity === "medium" ? "magenta" : "gray"} size="sm">
          {c.severity === "high" ? "High" : c.severity === "medium" ? "Medium" : "Low"} relevance
        </Tag>
        {c.detectedBy === "llm" && (
          <Tag type="cool-gray" size="sm">
            AI-detected
          </Tag>
        )}
      </div>
    </div>
  );
}

export function ContradictionsPanel(props: {
  loading: boolean;
  contradictions: Contradiction[];
  relevant: string[];
  focusId: string | null;
  documents: DocumentMeta[];
  onOpenSource: OpenSource;
}) {
  const relevant = props.contradictions.filter((c) => props.relevant.includes(c.id));
  const others = props.contradictions.filter((c) => !props.relevant.includes(c.id));
  const focusInOthers = others.some((c) => c.id === props.focusId);
  return (
    <section className="contradictions" aria-labelledby="contradictions-title">
      <h2 id="contradictions-title" className="contradictions__title">
        Contradictions in the documents <Tag type="red" size="sm">{props.contradictions.length}</Tag>
      </h2>
      <p className="muted contradictions__lead">Passages that cannot all be true. Open each source to compare.</p>
      {props.loading && <SkeletonText paragraph lineCount={4} />}
      {!props.loading && props.contradictions.length === 0 && <p className="muted">No contradictions found.</p>}
      {relevant.length > 0 && <h3 className="contradictions__group">Relevant to this briefing</h3>}
      {relevant.map((c) => (
        <ContradictionCard key={c.id} c={c} documents={props.documents} onOpenSource={props.onOpenSource} focused={props.focusId === c.id} />
      ))}
      {relevant.length === 0 &&
        others.map((c) => (
          <ContradictionCard key={c.id} c={c} documents={props.documents} onOpenSource={props.onOpenSource} focused={props.focusId === c.id} />
        ))}
      {relevant.length > 0 && others.length > 0 && (
        <Accordion size="md">
          <AccordionItem title={`Other contradictions (${others.length})`} open={focusInOthers}>
            {others.map((c) => (
              <ContradictionCard key={c.id} c={c} documents={props.documents} onOpenSource={props.onOpenSource} focused={props.focusId === c.id} />
            ))}
          </AccordionItem>
        </Accordion>
      )}
    </section>
  );
}
