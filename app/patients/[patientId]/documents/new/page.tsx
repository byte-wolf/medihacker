import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { allergyLines } from "@/lib/data/allergies";
import { getPatient } from "@/lib/data/patients";
import { readStructured } from "@/lib/data/structured";
import { prefillAnesthesia } from "@/lib/documents/anesthesia";
import { DOCUMENT_TYPES, isDocumentType } from "@/lib/documents/catalog";
import { docKindLabel, formatDate } from "@/lib/format";
import { AppHeader } from "@/components/AppHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { NewDocument } from "@/components/documents/NewDocument";

async function NewDocumentContent({ params, searchParams }: PageProps<"/patients/[patientId]/documents/new">) {
  await connection();
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { patientId } = await params;
  const patient = getPatient(patientId);
  if (!patient) notFound();
  const sp = await searchParams;

  // Pre-filled from the structured extracts and the documents only: no LLM call.
  const prefill = prefillAnesthesia({
    patient,
    structured: readStructured(patient),
    allergyPassages: allergyLines(patient),
    referenceDate: patient.latestDocumentDate,
  });
  const docLabels = Object.fromEntries(patient.documents.map((d) => [d.id, `${docKindLabel(d.title, d.type)} · ${formatDate(d.date)}`]));

  return (
    <>
      <AppHeader user={user} />
      <main id="main-content" className="app-content page-container doc-page">
        <NewDocument
          patientId={patient.id}
          types={DOCUMENT_TYPES.map(({ id, title, description }) => ({ id, title, description }))}
          initialType={isDocumentType(sp.type) ? sp.type : null}
          prefill={prefill}
          docLabels={docLabels}
        />
      </main>
    </>
  );
}

export default function NewDocumentPage(props: PageProps<"/patients/[patientId]/documents/new">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewDocumentContent {...props} />
    </Suspense>
  );
}
