"use client";

import { Button, InlineNotification, SkeletonText } from "@carbon/react";
import { Checkmark, Copy, Renew } from "@carbon/icons-react";
import { useState } from "react";
import type { BriefingItem, DocumentMeta, TokenCall } from "@/lib/types";
import { ItemRow } from "./ItemRow";
import { docLabel } from "./SourceTags";
import type { BriefingState, OpenSource, SituationOption } from "./types";

function tokenTooltip(calls: TokenCall[]) {
  return calls.map((c) => `${c.tag}: ${c.cached ? "cached" : `${c.prompt} in + ${c.completion} out (${c.model})`}`).join("\n");
}

/** Plain-text briefing with its sources, e.g. for pasting into the consent note. */
function briefingText(title: string, items: BriefingItem[], documents: DocumentMeta[]) {
  const lines = items.map((item) => {
    if (item.status !== "documented") return `${item.label}: ${item.status === "not_documented" ? "Not documented" : "Not verified"}${item.note ? ` (${item.note})` : ""}`;
    const facts = item.facts.map((f) => {
      const docs = [...new Set([...f.quotes, ...(f.calculation?.inputs ?? [])].map((q) => q.passageId.split(":")[0]))];
      return `${f.statement} [${docs.map((d) => docLabel(documents, d)).join("; ")}]`;
    });
    return `${item.label}: ${facts.join(" ")}`;
  });
  return [`Briefing: ${title}`, ...lines].join("\n");
}

export function BriefingView({
  state,
  situation,
  documents,
  contradictionTitles,
  onOpenSource,
  onShowContradiction,
  onRetry,
  aiConfigured,
}: {
  state: BriefingState;
  situation: SituationOption | null;
  documents: DocumentMeta[];
  contradictionTitles: Record<string, string>;
  onOpenSource: OpenSource;
  onShowContradiction: (id: string) => void;
  onRetry: () => void;
  aiConfigured: boolean;
}) {
  const [copied, setCopied] = useState(false);
  if (!situation) return null;
  const copy = async () => {
    const items = state.plan.flatMap((p) => state.sections[p.id]?.items ?? []);
    try {
      await navigator.clipboard.writeText(briefingText(situation.title, items, documents));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  const loading = state.status === "loading";
  const showPlanSkeleton = loading && state.plan.length === 0;
  return (
    <section className="briefing" aria-labelledby="briefing-title" aria-busy={loading}>
      <div className="briefing__head">
        <h2 id="briefing-title">Briefing</h2>
        <span className="briefing__meta" aria-live="polite">
          {loading && "Reading 8 documents…"}
          {state.status === "done" && state.ms !== undefined && `Ready in ${(state.ms / 1000).toFixed(1)} s${state.cached ? " (cached)" : ""}`}
          {state.status === "done" && state.tokens !== undefined && (
            <span title={tokenTooltip(state.tokenCalls ?? [])}> · {state.tokens.toLocaleString("en")} tokens</span>
          )}
        </span>
        {state.status === "done" && (
          <Button kind="ghost" size="sm" className="briefing__copy" renderIcon={copied ? Checkmark : Copy} onClick={() => void copy()}>
            {copied ? "Copied" : "Copy as text"}
          </Button>
        )}
      </div>
      <div className="briefing__body">
      {state.status === "error" && (
        <InlineNotification kind="error" lowContrast hideCloseButton title="The briefing could not be loaded." subtitle={state.error}>
        </InlineNotification>
      )}
      {state.status === "error" && (
        <Button kind="tertiary" size="sm" renderIcon={Renew} onClick={onRetry}>
          Retry
        </Button>
      )}
      {state.fallback && aiConfigured && (
        <InlineNotification
          kind="info"
          lowContrast
          hideCloseButton
          title="The AI model did not answer for some sections."
          subtitle="Those sections show matching German source passages (keyword search) instead of summaries. Retry later."
        />
      )}
      {showPlanSkeleton && (
        <div className="briefing-group">
          <SkeletonText paragraph lineCount={4} />
        </div>
      )}
      {state.plan.map((plan) => {
        const section = state.sections[plan.id];
        const error = state.sectionErrors[plan.id];
        return (
          <div key={plan.id} className="briefing-group" data-section={plan.id} aria-label={plan.title} role="group">
            {section
              ? section.items.map((item) => (
                  <ItemRow
                    key={item.key}
                    item={item}
                    documents={documents}
                    onOpenSource={onOpenSource}
                    contradictionTitles={contradictionTitles}
                    onShowContradiction={onShowContradiction}
                  />
                ))
              : plan.items.map((i) => (
                  <div className="item-row item-row--loading" key={i.key}>
                    <div className="item-row__label">
                      <h3>{i.label}</h3>
                    </div>
                    <div className="item-row__body">
                      {error ? <span className="muted">{error}</span> : <SkeletonText width="70%" />}
                    </div>
                  </div>
                ))}
            {error && (
              <Button kind="ghost" size="sm" renderIcon={Renew} onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        );
      })}
      {state.status === "done" && (
        <p className="briefing__legend">
          Each fact links to the passage it was taken from; a click opens it beside the briefing. <em>calc. from</em> marks values calculated from
          the linked sources, <span className="briefing__legend-flag">Documents differ</span> marks facts where the letters disagree. Check the
          source before clinical decisions.
        </p>
      )}
      </div>
    </section>
  );
}
