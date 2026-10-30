"use client";

import { Button, RadioTile, TileGroup } from "@carbon/react";
import { ArrowLeft } from "@carbon/icons-react";
import { useState } from "react";
import type { Checklist } from "@/lib/documents/anesthesia";
import type { DocumentMeta } from "@/lib/types";
import { AnesthesiaChecklist } from "./AnesthesiaChecklist";

type DocType = { id: string; title: string; description: string };

/** "What document?" menu, then the chosen form. */
export function NewDocument(props: {
  patientId: string;
  types: DocType[];
  initialType: string | null;
  prefill: Checklist;
  docLabels: Record<string, string>;
  documents: DocumentMeta[];
}) {
  const [type, setType] = useState<string | null>(props.initialType);
  const backHref = `/patients/${props.patientId}`;

  if (type === "preop-anesthesia") {
    return (
      <>
        <div className="doc-page__top">
          <Button kind="ghost" size="sm" renderIcon={ArrowLeft} onClick={() => setType(null)}>
            Choose another document
          </Button>
        </div>
        <AnesthesiaChecklist patientId={props.patientId} prefill={props.prefill} docLabels={props.docLabels} documents={props.documents} backHref={backHref} />
      </>
    );
  }

  return (
    <>
      <div className="doc-page__top">
        <Button kind="ghost" size="sm" renderIcon={ArrowLeft} href={backHref}>
          Back to patient
        </Button>
      </div>
      <h1 className="page-title">Create new document</h1>
      <section className="doc-picker" aria-label="Document type">
        <TileGroup
          name="document-type"
          legend="What document?"
          valueSelected={type ?? undefined}
          onChange={(v) => setType(String(v))}
        >
          {props.types.map((t) => (
            <RadioTile key={t.id} id={`doc-type-${t.id}`} value={t.id}>
              <span className="doc-picker__title">{t.title}</span>
              <span className="doc-picker__desc">{t.description}</span>
            </RadioTile>
          ))}
        </TileGroup>
      </section>
    </>
  );
}
