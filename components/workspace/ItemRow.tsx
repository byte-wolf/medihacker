"use client";

import { Tag } from "@carbon/react";
import { CheckmarkFilled, HelpFilled, WarningAltFilled } from "@carbon/icons-react";
import type { BriefingItem, DocumentMeta } from "@/lib/types";
import { SourceTags } from "./SourceTags";
import type { OpenSource } from "./types";

/** Highlight the leading drug name / value of a statement for scanning. */
function Statement({ text }: { text: string }) {
  const m = text.match(/^([^,:;(]{1,48}?)([,:;(]|\s[-–]\s)([\s\S]*)$/);
  if (!m) return <span>{text}</span>;
  return (
    <span>
      <strong>{m[1]}</strong>
      {m[2]}
      {m[3]}
    </span>
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
  return (
    <div className={`item-row item-row--${item.status}`} data-item={item.key}>
      <div className="item-row__label">
        {item.status === "documented" && <CheckmarkFilled size={16} aria-hidden className="icon-ok" />}
        {item.status === "not_documented" && <HelpFilled size={16} aria-hidden className="icon-muted" />}
        {item.status === "unverified" && <WarningAltFilled size={16} aria-hidden className="icon-warn" />}
        <h3>{item.label}</h3>
      </div>
      <div className="item-row__body">
        {item.status === "documented" ? (
          <ul className="fact-list">
            {item.facts.map((f, i) => (
              <li key={i} className="fact">
                <Statement text={f.statement} />
                <SourceTags
                  fact={f}
                  documents={documents}
                  onOpenSource={onOpenSource}
                  contradictionTitles={contradictionTitles}
                  onShowContradiction={onShowContradiction}
                />
              </li>
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
