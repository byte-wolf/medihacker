"use client";

import { Button, InlineNotification, SkeletonText, Tag, Toggle } from "@carbon/react";
import { Close } from "@carbon/icons-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { docKindLabel, formatDate } from "@/lib/format";
import type { DocumentMeta, SourceDocument } from "@/lib/types";

type DocResponse = {
  document: SourceDocument;
  passages: { id: string; start: number; end: number }[];
  translations: Record<string, string>;
};

/** The full source document with the cited passages highlighted and scrolled into view. */
export function SourcePanel(props: {
  patientId: string;
  docId: string;
  passageIds: string[];
  context?: string;
  documents: DocumentMeta[];
  onClose: () => void;
  onNavigate: (docId: string, passageIds: string[]) => void;
}) {
  const { patientId, docId, passageIds, onClose } = props;
  const [data, setData] = useState<DocResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [translate, setTranslate] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const firstMark = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/documents/${patientId}/${docId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as DocResponse;
      })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [patientId, docId]);

  // Opening a source costs no model calls. Translate only missing highlighted passages.
  const missingTranslations = JSON.stringify(data?.passages.filter((p) => passageIds.includes(p.id) && !data.translations[p.id]).map((p) => p.id) ?? []);
  const translating = translate && missingTranslations !== "[]" && !translationError;
  useEffect(() => {
    const ids = JSON.parse(missingTranslations) as string[];
    if (!translate || !ids.length) return;
    let cancelled = false;
    fetch(`/api/documents/${patientId}/${docId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passageIds: ids.slice(0, 20) }),
    }).then(async (r) => {
      const result = await r.json();
      if (!r.ok) throw new Error(result.error ?? "Translation could not be generated.");
      if (!cancelled) {
        setTranslationError(null);
        setData((current) => current ? { ...current, translations: { ...current.translations, ...result.translations } } : current);
      }
    }).catch((e) => !cancelled && setTranslationError(e.message));
    return () => { cancelled = true; };
  }, [translate, missingTranslations, patientId, docId]);

  useEffect(() => {
    // Scroll only the panel's own container so the briefing keeps its position.
    const mark = firstMark.current;
    const rail = mark?.closest(".workspace__rail");
    if (data && mark && rail) {
      const top = mark.getBoundingClientRect().top - rail.getBoundingClientRect().top + rail.scrollTop;
      rail.scrollTo({ top: Math.max(0, top - rail.clientHeight / 3), behavior: "smooth" });
    }
  }, [data, passageIds]);

  // Move focus into the panel when it opens; Esc closes it (capture phase, so tooltips cannot swallow the key).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const meta = props.documents.find((d) => d.id === docId);
  const highlighted = data ? data.passages.filter((p) => passageIds.includes(p.id)).sort((a, b) => a.start - b.start) : [];

  // Split the text into plain and highlighted segments.
  const segments: { text: string; mark: boolean; id?: string }[] = [];
  if (data) {
    let pos = 0;
    for (const p of highlighted) {
      if (p.start < pos) continue;
      segments.push({ text: data.document.text.slice(pos, p.start), mark: false });
      segments.push({ text: data.document.text.slice(p.start, p.end), mark: true, id: p.id });
      pos = p.end;
    }
    segments.push({ text: data.document.text.slice(pos), mark: false });
  }
  let markIndex = 0;

  return (
    <div className="source-panel" role="region" aria-label="Source document">
      <div className="source-panel__head">
        <div>
          <p className="source-panel__eyebrow">Source</p>
          <h2 className="source-panel__title">{meta ? docKindLabel(meta.title, meta.type) : docId}</h2>
          {meta && (
            <p className="source-panel__meta">
              {meta.title} · {formatDate(meta.date)} · {meta.department}
            </p>
          )}
        </div>
        <Button ref={closeRef} kind="ghost" size="sm" hasIconOnly renderIcon={Close} iconDescription="Close source (Esc)" onClick={onClose} />
      </div>
      {props.context && (
        <p className="source-panel__context">
          <span className="muted">Checking:</span> {props.context}
        </p>
      )}
      <Toggle
        id="translate-toggle"
        size="sm"
        labelText="Show English translation of the highlighted passage"
        labelA="Off"
        labelB="On"
        toggled={translate}
        onToggle={(enabled) => { setTranslate(enabled); setTranslationError(null); }}
      />
      {translate && data && (
        <div className="source-panel__translation">
          {highlighted.map((p) => (
            <p key={p.id}>
              {data.translations[p.id] ?? <span className="muted">{translating ? "Translating selected passages…" : "Translation unavailable. Toggle off and on to retry."}</span>}
            </p>
          ))}
          <Tag type="cool-gray" size="sm">
            Machine translation
          </Tag>
          {translationError && <InlineNotification kind="error" lowContrast hideCloseButton title="Translation unavailable" subtitle={translationError} />}
        </div>
      )}
      {error && <InlineNotification kind="error" lowContrast hideCloseButton title="Could not load the document." subtitle={error} />}
      {!data && !error && <SkeletonText paragraph lineCount={10} />}
      {data && (
        <div className="source-panel__text" lang="de" tabIndex={0} aria-label="Document text (German original)">
          {segments.map((s, i) =>
            s.mark ? (
              <mark
                key={i}
                className="source-highlight"
                data-passage={s.id}
                ref={(el) => {
                  if (markIndex++ === 0) firstMark.current = el;
                }}
              >
                {s.text}
              </mark>
            ) : (
              <Fragment key={i}>{s.text}</Fragment>
            ),
          )}
        </div>
      )}
    </div>
  );
}
