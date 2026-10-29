"use client";

import { Button, InlineNotification } from "@carbon/react";
import { Renew } from "@carbon/icons-react";
import { useEffect } from "react";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main-content" className="app-content page-container">
      <h1 className="page-title">This view could not be shown</h1>
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title="Something went wrong while showing this page."
        subtitle="No patient facts are shown, so nothing unverified is displayed. Try again, or go back to the patient list."
      />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <Button renderIcon={Renew} onClick={() => retry()}>
          Try again
        </Button>
        <Button kind="secondary" href="/patients">
          Patient list
        </Button>
      </div>
    </main>
  );
}
