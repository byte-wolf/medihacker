"use client";

import { Button, InlineNotification, SkeletonText, Tile } from "@carbon/react";
import { ArrowRight, Renew, WarningAltFilled } from "@carbon/icons-react";
import type { DocumentMeta } from "@/lib/types";
import { ItemRow } from "./ItemRow";
import type { BriefingState, OpenSource, SituationOption } from "./types";

export function BriefingView({
  state,
  situation,
  documents,
  contradictionTitles,
  onOpenSource,
  onShowContradiction,
  onRetry,
  aiConfigured,
  roleSituations,
  onSelectSituation,
  contradictionCount,
}: {
  state: BriefingState;
  situation: SituationOption | null;
  documents: DocumentMeta[];
  contradictionTitles: Record<string, string>;
  onOpenSource: OpenSource;
  onShowContradiction: (id: string) => void;
  onRetry: () => void;
  aiConfigured: boolean;
  roleSituations: SituationOption[];
  onSelectSituation: (id: number) => void;
  contradictionCount: number;
}) {
  if (!situation) {
    return (
      <section className="briefing" aria-labelledby="briefing-title">
        <Tile className="no-situation">
          <h2 id="briefing-title">No situation selected</h2>
          <p className="muted">
            Ask a question in the bar below, or choose a situation to get a briefing with only the facts it needs.
          </p>
          {roleSituations.length > 0 && (
            <>
              <h3 className="no-situation__subtitle">Your situations</h3>
              <ul className="no-situation__list">
                {roleSituations.map((s) => (
                  <li key={s.id}>
                    <button type="button" className="demo-user" onClick={() => onSelectSituation(s.id)}>
                      <span>
                        <span className="demo-user__role">{s.title}</span>
                        <span className="demo-user__meta">{s.description}</span>
                      </span>
                      <ArrowRight size={16} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Tile>
        {contradictionCount > 0 && (
          <a href="#contradictions-title" className="contradiction-jump">
            <WarningAltFilled size={16} aria-hidden className="sev-medium" />
            <span>
              <strong>{contradictionCount} contradictions in the documents.</strong> Show them
            </span>
          </a>
        )}
      </section>
    );
  }
  const loading = state.status === "loading";
  const showPlanSkeleton = loading && state.plan.length === 0;
  return (
    <section className="briefing" aria-labelledby="briefing-title" aria-busy={loading}>
      <div className="briefing__head">
        <h2 id="briefing-title">Briefing for this situation</h2>
        <span className="briefing__meta" aria-live="polite">
          {loading && "Reading 8 documents…"}
          {state.status === "done" && state.ms !== undefined && `Ready in ${(state.ms / 1000).toFixed(1)} s${state.cached ? " (cached)" : ""}`}
        </span>
      </div>
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
          title="Keyword search mode."
          subtitle="Rows show the matching German source passages, not verified summaries."
        />
      )}
      {state.contradictions.length > 0 && (
        <a href="#contradictions-title" className="contradiction-jump">
          <WarningAltFilled size={16} aria-hidden className="sev-medium" />
          <span>
            <strong>{state.contradictions.length} contradictions in the documents.</strong>{" "}
            {state.relevantContradictions.length ? `${state.relevantContradictions.length} relevant to this briefing. ` : ""}Show them
          </span>
        </a>
      )}
      {showPlanSkeleton && (
        <Tile className="briefing-section">
          <SkeletonText heading width="30%" />
          <SkeletonText paragraph lineCount={3} />
        </Tile>
      )}
      {state.plan.map((plan) => {
        const section = state.sections[plan.id];
        const error = state.sectionErrors[plan.id];
        return (
          <Tile key={plan.id} className="briefing-section" data-section={plan.id}>
            <h2 className="briefing-section__title">{plan.title}</h2>
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
          </Tile>
        );
      })}
      {state.status === "done" && (
        <p className="briefing__footer">
          Generated from {documents.length} source documents. Every statement links to its source passage; facts that could not be
          matched to the source text are not shown. Verify before clinical decisions.
        </p>
      )}
    </section>
  );
}
