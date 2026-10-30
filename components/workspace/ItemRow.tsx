"use client";

import { Tag } from "@carbon/react";
import { CheckmarkFilled, HelpFilled, WarningAltFilled } from "@carbon/icons-react";
import type { BriefingItem, DocumentMeta } from "@/lib/types";
import { ExplainButton } from "./ExplainButton";
import { SourceTags } from "./SourceTags";
import type { OpenSource } from "./types";

/** Highlight the leading drug name / value of a statement for scanning. */
function Statement({ text }: { text: string }) {
  const m = text.match(/^([^,:;(]{1,48}?)([,:;(]|\s[-–]\s)([\s\S]*)$/);
  if (!m) return <span className="fact__statement">{text}</span>;
  return (
    <span className="fact__statement">
      <strong>{m[1]}</strong>
      {m[2]}
      {m[3]}
    </span>
  );
}

/** One fact; a contradicting fact sits in a red box that opens the contradiction details on click. */
function FactRow({
  fact,
  documents,
  onOpenSource,
  contradictionTitles,
  onShowContradiction,
}: {
  fact: BriefingItem["facts"][number];
  documents: DocumentMeta[];
  onOpenSource: OpenSource;
  contradictionTitles: Record<string, string>;
  onShowContradiction: (id: string) => void;
}) {
  const ids = fact.contradictionIds ?? [];
  const tags = <SourceTags fact={fact} documents={documents} onOpenSource={onOpenSource} />;
  if (ids.length === 0) {
    return (
      <li className="fact">
        <Statement text={fact.statement} />
        {tags}
      </li>
    );
  }
  const reason = ids.map((id) => contradictionTitles[id] ?? "documents disagree").join("; ");
  return (
    <li
      className="fact fact--contradiction"
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("button, a")) onShowContradiction(ids[0]);
      }}
    >
      <button
        type="button"
        className="fact__contradiction"
        onClick={() => onShowContradiction(ids[0])}
        aria-label={`Contradiction: ${reason}. Show details`}
      >
        <WarningAltFilled size={16} aria-hidden />
      </button>
      <span className="fact__reason" aria-hidden>
        <strong>Contradiction:</strong> {reason}
      </span>
      <Statement text={fact.statement} />
      {tags}
    </li>
  );
}

export function ItemRow({
  item,
  documents,
  onOpenSource,
  contradictionTitles,
  onShowContradiction,
  explainSituationId,
}: {
  item: BriefingItem;
  documents: DocumentMeta[];
  onOpenSource: OpenSource;
  contradictionTitles: Record<string, string>;
  onShowContradiction: (id: string) => void;
  /** Briefing only: show the "why this matters" button for this situation */
  explainSituationId?: number;
}) {
  return (
    <div className={`item-row item-row--${item.status}`} data-item={item.key}>
      <div className="item-row__label">
        {item.status === "documented" && <CheckmarkFilled size={16} aria-hidden className="icon-ok" />}
        {item.status === "not_documented" && <HelpFilled size={16} aria-hidden className="icon-muted" />}
        {item.status === "unverified" && <WarningAltFilled size={16} aria-hidden className="icon-warn" />}
        <h3>{item.label}</h3>
        {explainSituationId !== undefined && <ExplainButton situationId={explainSituationId} label={item.label} />}
      </div>
      <div className="item-row__body">
        {item.status === "documented" ? (
          <ul className="fact-list">
            {item.facts.map((f, i) => (
              <FactRow
                key={i}
                fact={f}
                documents={documents}
                onOpenSource={onOpenSource}
                contradictionTitles={contradictionTitles}
                onShowContradiction={onShowContradiction}
              />
            ))}
          </ul>
        ) : (
          <div className="item-row__note">
            <Tag type={item.status === "not_documented" ? "gray" : "warm-gray"} size="sm">
              {item.status === "not_documented" ? "Not documented" : "Not verified"}
            </Tag>{" "}
            {item.note}
          </div>
        )}
      </div>
    </div>
  );
}
