import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { listPatients } from "@/lib/data/patients";
import { AppHeader } from "@/components/AppHeader";
import { PatientList } from "@/components/PatientList";
import { PageSkeleton } from "@/components/PageSkeleton";

async function PatientsContent() {
  await connection();
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <>
      <AppHeader user={user} />
      <main id="main-content" className="app-content page-container">
        <PatientList patients={listPatients()} />
      </main>
    </>
  );
}

export default function PatientsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PatientsContent />
    </Suspense>
  );
}
