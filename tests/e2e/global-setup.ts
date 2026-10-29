import fs from "node:fs";

export default function globalSetup() {
  fs.mkdirSync("test-results", { recursive: true });
  for (const f of ["e2e.db", "e2e.db-wal", "e2e.db-shm"]) fs.rmSync(`test-results/${f}`, { force: true });
}
