import { Suspense } from "react";
import { connection } from "next/server";
import { getDb, schema } from "@/lib/db";
import { AppHeader } from "@/components/AppHeader";
import { LoginForm } from "@/components/LoginForm";

async function LoginContent() {
  await connection();
  const users = getDb().select().from(schema.users).all();
  return <LoginForm users={users.map(({ username, displayName, role, department }) => ({ username, displayName, role, department }))} />;
}

export default function LoginPage() {
  return (
    <>
      <AppHeader user={null} />
      <main id="main-content" className="app-content login-page">
        <Suspense fallback={null}>
          <LoginContent />
        </Suspense>
      </main>
    </>
  );
}
