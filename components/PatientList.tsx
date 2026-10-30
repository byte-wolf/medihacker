"use client";

import { ClickableTile, Tag } from "@carbon/react";
import { ArrowRight, User } from "@carbon/icons-react";
import { formatDate } from "@/lib/format";
import type { PatientSummary } from "@/lib/types";

function ageAt(dob: string, iso: string) {
  const [by, bm, bd] = dob.split("-").map(Number);
  const [y, m, d] = iso.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export function PatientList({ patients }: { patients: PatientSummary[] }) {
  return (
    <section aria-labelledby="patients-title">
      <h1 id="patients-title" className="page-title">
        Select a patient
      </h1>
      {patients.length === 0 ? (
        <p className="muted">
          No patient data found. Put the hackathon data folder at <code>./data</code> (see README).
        </p>
      ) : (
        <ul className="patient-grid">
          {patients.map((p) => (
            <li key={p.id}>
              <ClickableTile href={`/patients/${p.id}`} className="patient-tile">
                <div className="patient-tile__head">
                  <User size={24} aria-hidden />
                  <h2 className="patient-tile__name">{p.name}</h2>
                  <ArrowRight size={20} aria-hidden className="patient-tile__arrow" />
                </div>
                <dl className="patient-tile__facts">
                  <div>
                    <dt>Born</dt>
                    <dd>{formatDate(p.dateOfBirth)}</dd>
                  </div>
                  <div>
                    <dt>Age at latest document</dt>
                    <dd>{ageAt(p.dateOfBirth, p.latestDocumentDate)}</dd>
                  </div>
                  <div>
                    <dt>Sex</dt>
                    <dd>{p.sex.charAt(0).toUpperCase() + p.sex.slice(1)}</dd>
                  </div>
                  <div>
                    <dt>Documents</dt>
                    <dd>
                      {p.documentCount} · latest {formatDate(p.latestDocumentDate)}
                    </dd>
                  </div>
                </dl>
                <Tag type="cool-gray" size="sm">
                  ID {p.id}
                </Tag>
              </ClickableTile>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
