"use client";

import { Button, InlineNotification, SkeletonText } from "@carbon/react";
import { Maximize, Minimize, Renew } from "@carbon/icons-react";
import { useState } from "react";
import type { DocumentMeta, TokenCall } from "@/lib/types";
import { ItemRow } from "./ItemRow";
import type { BriefingState, OpenSource, SituationOption } from "./types";

function tokenTooltip(calls: TokenCall[]) {
  return calls.map((c) => `${c.tag}: ${c.cached ? "cached" : `${c.prompt} in + ${c.completion} out (${c.model})`}`).join("\n");
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
  const [expanded, setExpanded] = useState(false);
  if (!situation) return null;
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
        <Button
          kind="ghost"
          size="sm"
          renderIcon={expanded ? Minimize : Maximize}
          aria-expanded={expanded}
          aria-controls="briefing-body"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "Collapse" : "Expand"}
        </Button>
      </div>
      <div id="briefing-body" className={`briefing__body${expanded ? " briefing__body--expanded" : ""}`} tabIndex={0} aria-label="Briefing content">
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
      </div>
    </section>
  );
}
