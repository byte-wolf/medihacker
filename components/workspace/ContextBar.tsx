"use client";

import { Button, ComboBox, Modal, Stack, TextArea, TextInput } from "@carbon/react";
import { Chat } from "@carbon/icons-react";
import { useState } from "react";
import type { SituationOption } from "./types";

type Option = SituationOption | { id: 0; title: string; group: "none" } | { id: -1; title: string; group: "new" };

const NONE: Option = { id: 0, title: "None (questions only)", group: "none" };
const NEW: Option = { id: -1, title: "+ New situation…", group: "new" };

function optionLabel(o: Option | null) {
  if (!o) return "";
  if (o.group === "none" || o.group === "new") return o.title;
  const prefix = o.group === "preset" ? "Example · " : o.group === "mine" ? "Mine · " : "";
  return `${prefix}${o.title}`;
}

export function ContextBar(props: {
  patientId: string;
  userRole: string;
  situations: SituationOption[];
  situation: SituationOption | null;
  hasMessages: boolean;
  onSelect: (id: number | null) => void;
  onCreated: (s: SituationOption) => void;
  onNewConversation: () => void;
}) {
  const { situation } = props;
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<number | null | undefined>(undefined);
  const [comboKey, setComboKey] = useState(0);

  const items: Option[] = [NONE, ...props.situations, NEW];
  const selected: Option = situation ?? NONE;

  const choose = (o: Option | null | undefined) => {
    if (!o) return;
    if (o.group === "new") {
      setCreating(true);
      setComboKey((k) => k + 1);
      return;
    }
    const id = o.group === "none" ? null : o.id;
    if (id === (situation?.id ?? null)) return;
    if (props.hasMessages) setPending(id);
    else props.onSelect(id);
  };

  const perspective = situation?.role && situation.role !== props.userRole ? `${props.userRole} + ${situation.role}` : props.userRole;

  return (
    <section className="context-bar" aria-label="Situation">
      <div className="context-bar__select">
        <ComboBox<Option>
          key={`${comboKey}-${selected.id}`}
          id="situation"
          titleText="Situation"
          items={items}
          initialSelectedItem={selected}
          itemToString={optionLabel}
          onChange={({ selectedItem }) => choose(selectedItem)}
          helperText="The situation stays fixed for this conversation until you change it."
          size="md"
        />
      </div>
      <div className="context-bar__perspective">
        <span className="context-bar__label">Perspective</span>
        <span>
          <strong>{perspective}</strong>
          {situation ? (
            <>
              {" "}· <span title={situation.description}>{situation.title}</span>
            </>
          ) : (
            " · no situation"
          )}
        </span>
        {situation?.description && <p className="context-bar__desc">{situation.description}</p>}
      </div>
      <div className="context-bar__actions">
        <Button kind="ghost" size="md" renderIcon={Chat} onClick={props.onNewConversation} disabled={!props.hasMessages}>
          New conversation
        </Button>
      </div>

      <NewSituationModal
        open={creating}
        patientId={props.patientId}
        onClose={() => setCreating(false)}
        onCreated={(s) => {
          setCreating(false);
          props.onCreated(s);
        }}
      />

      <Modal
        open={pending !== undefined}
        modalHeading="Change situation?"
        primaryButtonText="Change situation"
        secondaryButtonText="Keep current"
        onRequestClose={() => {
          setPending(undefined);
          setComboKey((k) => k + 1);
        }}
        onRequestSubmit={() => {
          props.onSelect(pending ?? null);
          setPending(undefined);
        }}
        size="sm"
      >
        <p>This starts a new conversation for the new situation. The current conversation is kept in your history.</p>
      </Modal>
    </section>
  );
}

function NewSituationModal(props: {
  open: boolean;
  patientId: string;
  onClose: () => void;
  onCreated: (s: SituationOption) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/situations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, description, patientId: props.patientId }),
    });
    setBusy(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Could not save the situation.");
      return;
    }
    const s = data.situation as { id: number; title: string; description: string; role: string | null; suggestedQuestions: string[] | null };
    setTitle("");
    setDescription("");
    setError(null);
    props.onCreated({ ...s, suggestedQuestions: s.suggestedQuestions ?? [], group: "mine" });
  };

  return (
    <Modal
      open={props.open}
      modalHeading="New situation"
      primaryButtonText={busy ? "Saving…" : "Save and open briefing"}
      primaryButtonDisabled={busy}
      secondaryButtonText="Cancel"
      onRequestClose={props.onClose}
      onRequestSubmit={submit}
      size="md"
    >
      <Stack gap={5}>
        <TextInput
          id="situation-title"
          labelText="Title"
          placeholder="e.g. Pre-operative anaesthesia check"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          invalid={!!error && !title.trim()}
          invalidText={error ?? undefined}
          data-modal-primary-focus
        />
        <TextArea
          id="situation-description"
          labelText="Description"
          placeholder="What are you about to do, and what do you need to know? You can name a different role (e.g. 'You are the pharmacist')."
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {error && title.trim() && <p className="error-text">{error}</p>}
      </Stack>
    </Modal>
  );
}
