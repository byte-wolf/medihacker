import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { allergyLines } from "@/lib/data/allergies";
import { ageAt, getPatient } from "@/lib/data/patients";
import { ensureContradictions, listContradictions } from "@/lib/contradictions/store";
import { DEFAULT_QUESTIONS, ROLE_QUESTIONS } from "@/lib/catalog/situations";
import { ensureTranslations } from "@/lib/data/translations";
import { llmConfigured } from "@/lib/llm/provider";
import { logAudit, situationsForUser } from "@/lib/repo";
import { AppHeader } from "@/components/AppHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Workspace } from "@/components/workspace/Workspace";
import type { SituationOption, WorkspacePatient } from "@/components/workspace/types";

async function WorkspaceContent({ params, searchParams }: PageProps<"/patients/[patientId]">) {
  await connection();
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { patientId } = await params;
  const patient = getPatient(patientId);
  if (!patient) notFound();
  const sp = await searchParams;
  ensureContradictions(patient);
  void ensureTranslations(patient);
  logAudit(user.id, patient.id, "open_patient");

  // CAVE banner: allergy lines from the "Allergien" sections, newest document first.
  const allergies = allergyLines(patient);

  const { mine, presets } = situationsForUser(user.id);
  const toOption = (s: (typeof mine)[number], group: SituationOption["group"]): SituationOption => ({
    id: s.id,
    title: s.title,
    description: s.description,
    role: s.role,
    suggestedQuestions: s.suggestedQuestions ?? [],
    group,
  });
  const situations = [...mine.map((s) => toOption(s, s.isPreset ? "assigned" : "mine")), ...presets.map((s) => toOption(s, "preset"))];
  const requested = Number(sp.situation);
  const initialSituationId = situations.some((s) => s.id === requested) ? requested : null;

  const wp: WorkspacePatient = {
    id: patient.id,
    name: patient.name,
    sex: patient.sex,
    dateOfBirth: patient.dateOfBirth,
    age: ageAt(patient.dateOfBirth, patient.latestDocumentDate),
    latestDocumentDate: patient.latestDocumentDate,
    documents: patient.documents.map(({ id, title, date, type, department }) => ({ id, title, date, type, department })),
    allergies,
  };

  return (
    <>
      <AppHeader user={user} />
      <Workspace
        patient={wp}
        user={{ role: user.role, department: user.department }}
        situations={situations}
        initialSituationId={initialSituationId}
        aiConfigured={llmConfigured()}
        initialContradictions={listContradictions(patient.id)}
        roleQuestions={ROLE_QUESTIONS[user.role] ?? DEFAULT_QUESTIONS}
      />
    </>
  );
}

export default function PatientPage(props: PageProps<"/patients/[patientId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WorkspaceContent {...props} />
    </Suspense>
  );
}
