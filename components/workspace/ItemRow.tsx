"use client";

import { WarningAlt } from "@carbon/icons-react";
import { emphasisSpans, isNoAllergyStatement } from "@/lib/briefing/emphasis";
import type { BriefingItem, DocumentMeta } from "@/lib/types";
import { SourceTags } from "./SourceTags";
import type { OpenSource } from "./types";

/** Safety-critical items: allergies get the danger accent, antithrombotics a stronger label. */
const SAFETY_ITEMS = new Set(["allergies", "antithrombotics"]);

/** Bold only the clinical value (drug + dose, number + unit, allergen); otherwise nothing. */
function Statement({ text }: { text: string }) {
  return (
    <span className="fact__statement">
      {emphasisSpans(text).map((s, i) => (s.strong ? <strong key={i}>{s.text}</strong> : s.text))}
    </span>
  );
}

/** One fact; when documents disagree about it, a visible amber "Documents differ" flag opens the details. */
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
      title={reason}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("button, a")) onShowContradiction(ids[0]);
      }}
    >
      <Statement text={fact.statement} />
      {tags}
      <button
        type="button"
        className="fact__contradiction"
        onClick={() => onShowContradiction(ids[0])}
        aria-label={`Contradiction: Documents differ. ${reason}. Show details`}
      >
        <WarningAlt size={14} aria-hidden />
        Documents differ
      </button>
    </li>
  );
}

export function ItemRow({
  item,
  documents,
  onOpenSource,
  contradictionTitles,
  onShowContradiction,
}: {
  item: BriefingItem;
  documents: DocumentMeta[];
  onOpenSource: OpenSource;
  contradictionTitles: Record<string, string>;
  onShowContradiction: (id: string) => void;
}) {
  const documented = item.status === "documented";
  const alert =
    documented && item.key === "allergies" && item.facts.some((f) => !isNoAllergyStatement(f.statement))
      ? " item-row--alert"
      : documented && SAFETY_ITEMS.has(item.key)
        ? " item-row--safety"
        : "";
  return (
    <div className={`item-row item-row--${item.status}${alert}`} data-item={item.key}>
      <div className="item-row__label">
        <h3>{item.label}</h3>
      </div>
      <div className="item-row__body">
        {documented ? (
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
            <span className="item-row__status">{item.status === "not_documented" ? "Not documented" : "Not verified"}</span>
            {item.note && <span className="item-row__why"> · {item.note}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
