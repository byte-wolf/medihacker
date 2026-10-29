"use client";

import { OperationalTag, Tag } from "@carbon/react";
import { WarningAltFilled } from "@carbon/icons-react";
import { formatDate } from "@/lib/format";
import type { OpenSource, WorkspacePatient } from "./types";

export function PatientBanner({ patient, onOpenSource }: { patient: WorkspacePatient; onOpenSource: OpenSource }) {
  return (
    <section className="patient-banner" aria-label="Patient">
      <div className="patient-banner__id">
        <h1 className="patient-banner__name">{patient.name}</h1>
        <span>
          {patient.sex === "female" ? "Female" : patient.sex === "male" ? "Male" : patient.sex} · born {formatDate(patient.dateOfBirth)} ·{" "}
          <strong>{patient.age} years</strong> <span className="muted">(at latest document, {formatDate(patient.latestDocumentDate)})</span>
        </span>
      </div>
      <div className="patient-banner__alerts">
        {patient.allergies.length > 0 ? (
          patient.allergies.map((a) => (
            <OperationalTag
              key={a.passageId}
              type="red"
              size="md"
              renderIcon={WarningAltFilled}
              text={`CAVE: ${a.text}`}
              onClick={() => onOpenSource(a.passageId.split(":")[0], [a.passageId], "Documented allergy")}
              aria-label={`Allergy: ${a.text}. Open source.`}
            />
          ))
        ) : (
          <Tag type="gray" size="md">
            No allergy section found
          </Tag>
        )}
        <Tag type="cool-gray" size="md">
          {patient.documents.length} documents · latest {formatDate(patient.latestDocumentDate)}
        </Tag>
      </div>
    </section>
  );
}
