"use client";

import { Button, InlineLoading, InlineNotification, TextArea, Tile } from "@carbon/react";
import { ArrowUp, ChevronDown, ChevronUp, Send } from "@carbon/icons-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";
import { flushSync } from "react-dom";
import type { BriefingItem, DocumentMeta } from "@/lib/types";
import { ItemRow } from "./ItemRow";
import type { ChatMessage, OpenSource, SituationOption } from "./types";

// Collapsed state of the question bar, remembered in localStorage across pages and reloads.
const COLLAPSED_KEY = "medihacker.askBarCollapsed";
const COLLAPSED_EVENT = "medihacker:ask-bar";
function subscribeCollapsed(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(COLLAPSED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(COLLAPSED_EVENT, onChange);
  };
}
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}
function writeCollapsed(value: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0");
  } catch {
    // Storage unavailable (private mode): the state still changes for this page.
  }
  window.dispatchEvent(new Event(COLLAPSED_EVENT));
}

/**
 * The conversation thread followed by the question bar, which is pinned to the bottom
 * of the window while the page scrolls.
 */
export function ChatPanel(props: {
  conversationId: number | null;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  situation: SituationOption | null;
  suggestions: string[];
  documents: DocumentMeta[];
  contradictionTitles: Record<string, string>;
  onOpenSource: OpenSource;
  onShowContradiction: (id: string) => void;
  disabled: boolean;
}) {
  const { messages, setMessages } = props;
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<HTMLElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const seq = useRef(0);
  const bodyId = useId();
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const expandAndFocus = () => {
    flushSync(() => writeCollapsed(false));
    inputRef.current?.focus();
  };
  const nextId = (prefix: string) => `${prefix}-${++seq.current}`;

  // Bring a new question and its answer into view.
  const lastId = messages.at(-1)?.id;
  useEffect(() => {
    if (lastId !== undefined && typeof lastId === "string") endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [lastId]);

  // "/" focuses the question bar from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key !== "/" || target?.closest("input, textarea, [contenteditable]")) return;
      e.preventDefault();
      flushSync(() => writeCollapsed(false));
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ask = async (text?: string) => {
    const q = (text ?? question).trim();
    if (!q || !props.conversationId || busy || props.disabled) return;
    setBusy(true);
    setQuestion("");
    const pendingId = nextId("pending");
    setMessages((m) => [...m, { id: nextId("u"), role: "user", text: q }, { id: pendingId, role: "pending" }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: props.conversationId, question: q }),
      });
      const data = await res.json();
      setMessages((m) =>
        m
          .filter((x) => x.id !== pendingId)
          .concat(
            res.ok
              ? [{ id: `a-${data.reply.id}`, role: "assistant", items: (data.reply.content as { items: BriefingItem[] }).items, latencyMs: data.reply.latencyMs }]
              : [{ id: nextId("e"), role: "error", text: data.error ?? "The answer could not be generated." }],
          ),
      );
    } catch {
      setMessages((m) => m.filter((x) => x.id !== pendingId).concat([{ id: nextId("e"), role: "error", text: "Network error. Please retry." }]));
    } finally {
      setBusy(false);
    }
  };

  const answered = messages.filter((m) => m.role === "assistant").length;
  const asked = new Set(messages.filter((m) => m.role === "user").map((m) => m.text));
  const suggestions = props.suggestions.filter((s) => !asked.has(s)).slice(0, 3);

  return (
    <>
      <section ref={threadRef} className="chat" aria-labelledby="chat-title">
        <h2 id="chat-title" className="chat__title">
          Questions and answers
        </h2>
        <p className="muted chat__lead">
          {props.situation ? `Answers stay in the context of “${props.situation.title}”.` : "No situation selected: answers use your role only."} Every
          answer is checked against the source documents.
        </p>
        {messages.length === 0 && <p className="chat__empty muted">Ask a question in the bar at the bottom of the window.</p>}
        <div className="chat__thread" aria-live="polite">
          {messages.map((m) => {
            if (m.role === "user")
              return (
                <div key={m.id} className="chat__q">
                  <span className="visually-hidden">You asked: </span>
                  {m.text}
                </div>
              );
            if (m.role === "pending")
              return (
                <div key={m.id} className="chat__a">
                  <InlineLoading description="Generating the answer from the documents…" />
                </div>
              );
            if (m.role === "error") return <InlineNotification key={m.id} kind="error" lowContrast hideCloseButton title={m.text} />;
            return (
              <Tile key={m.id} className="chat__a">
                {m.items.map((item) => (
                  <ItemRow
                    key={item.key}
                    item={item}
                    documents={props.documents}
                    onOpenSource={props.onOpenSource}
                    contradictionTitles={props.contradictionTitles}
                    onShowContradiction={props.onShowContradiction}
                  />
                ))}
              </Tile>
            );
          })}
          <div ref={endRef} className="chat__end" />
        </div>
      </section>

      <div className={`ask-bar${collapsed ? " ask-bar--collapsed" : ""}`} role="search" aria-label="Ask about this patient">
        <button
          type="button"
          className="ask-bar__toggle"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          aria-label={collapsed ? "Expand question bar" : "Collapse question bar"}
          title={collapsed ? "Expand question bar" : "Collapse question bar"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => (collapsed ? expandAndFocus() : writeCollapsed(true))}
        >
          {collapsed ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
        </button>
        {collapsed && (
          <div className="ask-bar__slim">
            <button type="button" className="ask-bar__slim-open" onClick={expandAndFocus}>
              {props.disabled ? "Questions need the AI model." : "Ask about this patient…"} <kbd>/</kbd>
            </button>
            {answered > 0 && (
              <button type="button" className="ask-bar__jump" onClick={() => threadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                <ArrowUp size={16} aria-hidden /> {answered} {answered === 1 ? "answer" : "answers"} in this conversation
              </button>
            )}
          </div>
        )}
        <div id={bodyId} className="ask-bar__body" hidden={collapsed}>
        {(suggestions.length > 0 || answered > 0) && (
          <div className="ask-bar__top">
            {suggestions.length > 0 && (
              <div className="ask-bar__suggestions" aria-label="Suggested questions">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="ask-bar__chip"
                    disabled={props.disabled || busy || !props.conversationId}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void ask(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {answered > 0 && (
              <button type="button" className="ask-bar__jump" onClick={() => threadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                <ArrowUp size={16} aria-hidden /> {answered} {answered === 1 ? "answer" : "answers"} in this conversation
              </button>
            )}
          </div>
        )}
        <form
          className="ask-bar__form"
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
        >
          <TextArea
            ref={inputRef}
            id="chat-question"
            labelText="Ask about this patient"
            hideLabel
            aria-keyshortcuts="/"
            placeholder={props.disabled ? "Questions need the AI model." : "Ask about this patient…  (press /)"}
            rows={1}
            value={question}
            disabled={props.disabled}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask();
              }
            }}
          />
          <Button type="submit" size="md" renderIcon={busy ? undefined : Send} disabled={props.disabled || busy || !question.trim() || !props.conversationId}>
            {busy ? <InlineLoading className="ask-bar__spinner" description="Answering…" /> : "Ask"}
          </Button>
        </form>
        </div>
      </div>
    </>
  );
}
