"use client";

import { InlineNotification, Modal } from "@carbon/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BriefingStreamEvent, Contradiction } from "@/lib/types";
import { BriefingView } from "./BriefingView";
import { ChatPanel } from "./ChatPanel";
import { ContextBar } from "./ContextBar";
import { ContradictionCard } from "./ContradictionsPanel";
import { PatientBanner } from "./PatientBanner";
import { SourcePanel } from "./SourcePanel";
import type { BriefingState, ChatMessage, SituationOption, WorkspacePatient } from "./types";

const EMPTY: BriefingState = {
  status: "idle",
  plan: [],
  sections: {},
  sectionErrors: {},
  contradictions: [],
  relevantContradictions: [],
  rejected: [],
};

type Source = { docId: string; passageIds: string[]; context?: string };

export function Workspace(props: {
  patient: WorkspacePatient;
  user: { role: string; department: string };
  situations: SituationOption[];
  initialSituationId: number | null;
  aiConfigured: boolean;
  initialContradictions: Contradiction[];
  roleQuestions: string[];
}) {
  const { patient } = props;
  const router = useRouter();
  const [situations, setSituations] = useState(props.situations);
  const [situationId, setSituationId] = useState<number | null>(props.initialSituationId);
  const [briefing, setBriefing] = useState<BriefingState>(EMPTY);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [source, setSource] = useState<Source | null>(null);
  const [focusContradiction, setFocusContradiction] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const situation = useMemo(() => situations.find((s) => s.id === situationId) ?? null, [situations, situationId]);

  const audit = useCallback(
    (action: string, details: unknown) =>
      void fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patientId: patient.id, action, details }),
      }).catch(() => {}),
    [patient.id],
  );

  const openSource = useCallback(
    (docId: string, passageIds: string[], context?: string) => {
      setSource({ docId, passageIds, context });
      audit("open_source", { docId, passageIds });
    },
    [audit],
  );

  const loadBriefing = useCallback(
    async (sid: number | null) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setBriefing({ ...EMPTY, status: "loading" });
      try {
        const res = await fetch("/api/briefing", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ patientId: patient.id, situationId: sid }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const e = JSON.parse(line) as BriefingStreamEvent;
            setBriefing((b) => reduce(b, e));
          }
        }
        setBriefing((b) => (b.status === "loading" ? { ...b, status: "done" } : b));
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setBriefing((b) => ({ ...b, status: "error", error: err instanceof Error ? err.message : String(err) }));
      }
    },
    [patient.id],
  );

  const openConversation = useCallback(
    async (sid: number | null, fresh = false) => {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patientId: patient.id, situationId: sid, fresh }),
      });
      const { conversation } = (await res.json()) as { conversation: { id: number } };
      setConversationId(conversation.id);
      const r = await fetch(`/api/conversations/${conversation.id}`);
      const data = (await r.json()) as { messages: { id: number; role: "user" | "assistant"; content: unknown; latencyMs: number | null }[] };
      setMessages(
        data.messages.map((m) =>
          m.role === "user"
            ? { id: m.id, role: "user", text: (m.content as { text: string }).text }
            : { id: m.id, role: "assistant", items: (m.content as { items: [] }).items, latencyMs: m.latencyMs },
        ),
      );
    },
    [patient.id],
  );

  // Load briefing and conversation whenever the situation changes.
  useEffect(() => {
    setSource(null);
    // "None" means no briefing: only the question bar and the contradictions.
    if (situationId) void loadBriefing(situationId);
    else abortRef.current?.abort();
    void openConversation(situationId);
    const url = new URL(window.location.href);
    if (situationId) url.searchParams.set("situation", String(situationId));
    else url.searchParams.delete("situation");
    window.history.replaceState(null, "", url);
    return () => abortRef.current?.abort();
  }, [situationId, loadBriefing, openConversation]);

  const onSituationCreated = (s: SituationOption) => {
    setSituations((list) => [s, ...list]);
    setSituationId(s.id);
    router.refresh();
  };

  const showContradiction = (id: string) => {
    setFocusContradiction(id);
    audit("open_contradiction", { id });
  };

  // Contradictions are known before any briefing; the briefing only adds which ones are relevant.
  const contradictions = briefing.contradictions.length ? briefing.contradictions : props.initialContradictions;
  const relevantContradictions = situationId ? briefing.relevantContradictions : [];
  const contradictionTitles = useMemo(() => Object.fromEntries(contradictions.map((c) => [c.id, c.title])), [contradictions]);
  const focused = focusContradiction ? (contradictions.find((c) => c.id === focusContradiction) ?? null) : null;

  return (
    <main id="main-content" className="app-content workspace">
      <PatientBanner patient={patient} onOpenSource={openSource} />
      <ContextBar
        patientId={patient.id}
        userRole={props.user.role}
        situations={situations}
        situation={situation}
        hasMessages={messages.some((m) => m.role === "user")}
        onSelect={setSituationId}
        onCreated={onSituationCreated}
        onNewConversation={() => void openConversation(situationId, true)}
      />
      {!props.aiConfigured && (
        <div className="workspace__notice">
          <InlineNotification
            kind="warning"
            lowContrast
            hideCloseButton
            title="AI model not configured."
            subtitle="Showing keyword-matched source passages in German instead of summarised facts. Free-text questions are unavailable."
          />
        </div>
      )}
      <div className={`workspace__grid${source ? " workspace__grid--source" : ""}`}>
        <div className="workspace__main">
          <BriefingView
            state={situationId ? briefing : { ...briefing, status: "idle" }}
            situation={situation}
            documents={patient.documents}
            contradictionTitles={contradictionTitles}
            onOpenSource={openSource}
            onShowContradiction={showContradiction}
            onRetry={() => void loadBriefing(situationId)}
            aiConfigured={props.aiConfigured}
          />
          <ChatPanel
            conversationId={conversationId}
            messages={messages}
            setMessages={setMessages}
            situation={situation}
            suggestions={situation?.suggestedQuestions.length ? situation.suggestedQuestions : props.roleQuestions}
            documents={patient.documents}
            contradictionTitles={contradictionTitles}
            onOpenSource={openSource}
            onShowContradiction={showContradiction}
            disabled={!props.aiConfigured}
          />
        </div>
        {source && (
          <aside className="workspace__rail" aria-label="Source document">
            <SourcePanel
              key={source.docId}
              patientId={patient.id}
              docId={source.docId}
              passageIds={source.passageIds}
              context={source.context}
              documents={patient.documents}
              onClose={() => setSource(null)}
              onNavigate={(docId, passageIds) => setSource({ docId, passageIds })}
            />
          </aside>
        )}
      </div>
      <Modal
        open={!!focused}
        passiveModal
        size="md"
        modalHeading={focused && relevantContradictions.includes(focused.id) ? "Contradiction relevant to this situation" : "Contradiction in the documents"}
        onRequestClose={() => setFocusContradiction(null)}
      >
        {focused && (
          <ContradictionCard
            c={focused}
            documents={patient.documents}
            focused={false}
            onOpenSource={(docId, passageIds, context) => {
              setFocusContradiction(null);
              openSource(docId, passageIds, context);
            }}
          />
        )}
      </Modal>
    </main>
  );
}

function reduce(b: BriefingState, e: BriefingStreamEvent): BriefingState {
  switch (e.type) {
    case "plan": {
      const known = new Set(b.plan.map((s) => s.id));
      return { ...b, plan: [...b.plan, ...e.sections.filter((s) => !known.has(s.id))] };
    }
    case "section":
      return { ...b, sections: { ...b.sections, [e.section.id]: e.section } };
    case "contradictions":
      return { ...b, contradictions: e.all, relevantContradictions: e.relevant };
    case "debug":
      return { ...b, rejected: [...b.rejected, ...e.rejected] };
    case "error":
      return e.sectionId
        ? { ...b, sectionErrors: { ...b.sectionErrors, [e.sectionId]: e.message } }
        : { ...b, status: "error", error: e.message };
    case "tokens":
      return { ...b, tokenCalls: e.calls, tokens: e.total };
    case "done":
      return { ...b, status: "done", ms: e.ms, cached: e.cached, fallback: e.fallback };
  }
}
