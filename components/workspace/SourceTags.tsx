"use client";

import { Document } from "@carbon/icons-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { docKindLabel, docKindShort, formatDate, formatShortDate } from "@/lib/format";
import type { DocumentMeta, Fact } from "@/lib/types";
import type { OpenSource } from "./types";

export function docLabel(documents: DocumentMeta[], docId: string) {
  const d = documents.find((x) => x.id === docId);
  return d ? `${docKindLabel(d.title, d.type)} · ${formatDate(d.date)}` : `Document ${docId}`;
}

/** Compact inline label, e.g. "Discharge 25 Oct" (year shown only when it differs from the latest document). */
export function docShortLabel(documents: DocumentMeta[], docId: string) {
  const d = documents.find((x) => x.id === docId);
  if (!d) return `Doc ${docId}`;
  const latest = documents.reduce((a, x) => (x.date > a ? x.date : a), "");
  return `${docKindShort(d.title, d.type)} ${formatShortDate(d.date, Number(latest.slice(0, 4)))}`;
}

// All source links of one briefing item share a single Tab stop; arrow keys move between them.
const LINK = "button.source-tag";
const groupOf = (el: Element) => el.closest(".item-row") ?? el.closest(".source-tags");

function syncTabStops(group: Element | null, current?: HTMLElement) {
  if (!group) return;
  const links = [...group.querySelectorAll<HTMLButtonElement>(LINK)];
  const active = current ?? links.find((l) => l.getAttribute("tabindex") === "0") ?? links[0];
  for (const l of links) {
    l.tabIndex = l === active ? 0 : -1;
    const hint = l.closest(".source-tags")?.querySelector("[data-source-hint]")?.id;
    if (links.length > 1 && hint) l.setAttribute("aria-describedby", hint);
    else l.removeAttribute("aria-describedby");
  }
}

function onArrowKey(e: KeyboardEvent<HTMLElement>) {
  const target = e.target as HTMLElement;
  if (!target.matches(LINK)) return;
  const group = groupOf(target);
  if (!group) return;
  const links = [...group.querySelectorAll<HTMLButtonElement>(LINK)];
  const i = links.indexOf(target as HTMLButtonElement);
  const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: links.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  const to = links[Math.max(0, Math.min(links.length - 1, next))];
  syncTabStops(group, to);
  to.focus();
}

/** Cited passages grouped by document, most recent document first. */
export function sourceRefs(facts: Fact[], documents: DocumentMeta[]): [string, string[]][] {
  const byDoc = new Map<string, string[]>();
  const add = (passageId: string) => {
    const docId = passageId.split(":")[0];
    const ids = byDoc.get(docId) ?? [];
    if (!ids.includes(passageId)) byDoc.set(docId, [...ids, passageId]);
  };
  for (const f of facts) {
    for (const q of f.quotes) add(q.passageId);
    for (const i of f.calculation?.inputs ?? []) add(i.passageId);
  }
  const date = (id: string) => documents.find((d) => d.id === id)?.date ?? "";
  return [...byDoc].sort((a, b) => date(b[0]).localeCompare(date(a[0])));
}

/**
 * Source links for one fact (or for all facts of an item that share the same sources).
 * Only the most recent document is shown; "+N" reveals the others, so the answer reads first.
 */
export function SourceTags({
  facts,
  documents,
  onOpenSource,
}: {
  facts: Fact[];
  documents: DocumentMeta[];
  onOpenSource: OpenSource;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const hintId = useId();
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const group = ref.current && groupOf(ref.current);
    syncTabStops(group);
    return () => syncTabStops(group);
  });

  const refs = sourceRefs(facts, documents);
  const shown = expanded ? refs : refs.slice(0, 1);
  const hiddenCount = refs.length - shown.length;
  const context = facts.map((f) => f.statement).join(" ");
  return (
    <span className="source-tags" ref={ref} onKeyDown={onArrowKey} onFocus={(e) => e.target.matches(LINK) && syncTabStops(groupOf(e.target), e.target)}>
      {facts.some((f) => f.kind === "calculated") && (
        <span className="source-tags__calc" title="Calculated from the values in the linked sources">
          calc.
        </span>
      )}
      {shown.map(([docId, ids]) => {
        const full = docLabel(documents, docId);
        const short = docShortLabel(documents, docId);
        const title = documents.find((d) => d.id === docId)?.title;
        return (
          <button
            key={docId}
            type="button"
            onClick={() => onOpenSource(docId, ids, context)}
            className="source-tag"
            aria-label={`Open source: ${short} (${full})`}
            title={title ? `${full} – ${title}` : full}
          >
            <Document size={12} aria-hidden />
            {short}
          </button>
        );
      })}
      {hiddenCount > 0 && (
        <button
          type="button"
          className="source-tags__more"
          onClick={() => setExpanded(true)}
          aria-label={`Show ${hiddenCount} more source${hiddenCount > 1 ? "s" : ""}`}
          title={refs.slice(1).map(([id]) => docLabel(documents, id)).join("\n")}
        >
          +{hiddenCount}
        </button>
      )}
      <span id={hintId} data-source-hint hidden>
        Arrow keys move between the sources of this item.
      </span>
    </span>
  );
}
