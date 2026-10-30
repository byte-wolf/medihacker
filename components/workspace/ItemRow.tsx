"use client";

import { WarningAlt } from "@carbon/icons-react";
import { emphasisSpans, isNoAllergyStatement } from "@/lib/briefing/emphasis";
import type { BriefingItem, DocumentMeta } from "@/lib/types";
import { SourceTags, sourceRefs } from "./SourceTags";
import type { OpenSource } from "./types";

/** Safety-critical items: allergies get the danger accent, antithrombotics a stronger label. */
export const SAFETY_ITEMS = new Set(["allergies", "antithrombotics"]);

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
  ownSources,
}: {
  fact: BriefingItem["facts"][number];
  ownSources: boolean;
  documents: DocumentMeta[];
  onOpenSource: OpenSource;
  contradictionTitles: Record<string, string>;
  onShowContradiction: (id: string) => void;
}) {
  const ids = fact.contradictionIds ?? [];
  const tags = ownSources ? <SourceTags facts={[fact]} documents={documents} onOpenSource={onOpenSource} /> : null;
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
      <span>
        <Statement text={fact.statement} />
        <button
          type="button"
          className="fact__contradiction"
          onClick={() => onShowContradiction(ids[0])}
          aria-label={`Contradiction: Documents differ. ${reason}. Show details`}
        >
          <WarningAlt size={14} aria-hidden />
          Documents differ
        </button>
      </span>
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
}: {
  item: BriefingItem;
  documents: DocumentMeta[];
  onOpenSource: OpenSource;
  contradictionTitles: Record<string, string>;
  onShowContradiction: (id: string) => void;
}) {
  const documented = item.status === "documented";
  // When every fact cites the same documents, show the sources once for the whole item.
  const docSets = item.facts.map((f) => sourceRefs([f], documents).map(([d]) => d).sort().join(","));
  const shared = documented && docSets.every((d) => d === docSets[0]);
  const alert =
    documented && item.key === "allergies" && item.facts.some((f) => !isNoAllergyStatement(f.statement))
      ? " item-row--alert"
      : documented && SAFETY_ITEMS.has(item.key)
        ? " item-row--safety"
        : "";
  return (
    <div className={`item-row item-row--${item.status}${alert}${shared ? " item-row--shared" : ""}`} data-item={item.key}>
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
                ownSources={!shared}
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
      {shared && (
        <div className="item-row__sources">
          <SourceTags facts={item.facts} documents={documents} onOpenSource={onOpenSource} />
        </div>
      )}
    </div>
  );
}
