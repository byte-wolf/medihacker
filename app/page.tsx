"use client";

import { Column, Grid, Heading, Tile } from "@carbon/react";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <Grid style={{ maxWidth: "1280px", width: "100%" }}>
        <Column lg={16} md={8} sm={4}>
          <Heading
            style={{ marginBottom: "0.5rem" }}
          >
            MediHacker
          </Heading>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <p
            style={{
              fontSize: "1rem",
              color: "var(--cds-text-secondary, #525252)",
              marginBottom: "2rem",
            }}
          >
            Enter your role and clinical task to get a focused view of the
            patient facts that matter.
          </p>
        </Column>

        <Column lg={8} md={6} sm={4}>
          <Tile>
            <p style={{ color: "var(--cds-text-secondary, #525252)" }}>
              Enter your role and task to get started
            </p>
          </Tile>
        </Column>
      </Grid>
    </main>
  );
}
