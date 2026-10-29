"use client";

import { Button, InlineLoading, InlineNotification, TextArea, Tile } from "@carbon/react";
import { Send } from "@carbon/icons-react";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { BriefingItem, DocumentMeta } from "@/lib/types";
import { ItemRow } from "./ItemRow";
import type { ChatMessage, OpenSource, SituationOption } from "./types";

export function ChatPanel(props: {
  conversationId: number | null;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  situation: SituationOption | null;
  documents: DocumentMeta[];
  contradictionTitles: Record<string, string>;
  onOpenSource: OpenSource;
  onShowContradiction: (id: string) => void;
  disabled: boolean;
}) {
  const { messages, setMessages } = props;
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages.length]);

  const ask = async () => {
    const q = question.trim();
    if (!q || !props.conversationId || busy) return;
    setBusy(true);
    setQuestion("");
    const pendingId = `pending-${Date.now()}`;
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", text: q }, { id: pendingId, role: "pending" }]);
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
              ? [{ id: data.reply.id, role: "assistant", items: (data.reply.content as { items: BriefingItem[] }).items, latencyMs: data.reply.latencyMs }]
              : [{ id: `e-${Date.now()}`, role: "error", text: data.error ?? "The answer could not be generated." }],
          ),
      );
    } catch {
      setMessages((m) => m.filter((x) => x.id !== pendingId).concat([{ id: `e-${Date.now()}`, role: "error", text: "Network error. Please retry." }]));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="chat" aria-labelledby="chat-title">
      <h2 id="chat-title" className="chat__title">
        Ask about this patient
      </h2>
      <p className="muted chat__lead">
        {props.situation ? `Answers stay in the context of “${props.situation.title}”.` : "No situation selected: answers use your role only."} Every
        answer is checked against the source documents.
      </p>
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
                <InlineLoading description="Searching the documents…" />
              </div>
            );
          if (m.role === "error")
            return <InlineNotification key={m.id} kind="error" lowContrast hideCloseButton title={m.text} />;
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
        <div ref={endRef} />
      </div>
      <form
        className="chat__form"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <TextArea
          id="chat-question"
          labelText="Your question"
          hideLabel
          placeholder={props.disabled ? "Free-text questions need the AI model." : "e.g. Is she on any blood thinner?"}
          rows={2}
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
        <Button type="submit" renderIcon={Send} disabled={props.disabled || busy || !question.trim() || !props.conversationId}>
          Ask
        </Button>
      </form>
    </section>
  );
}
