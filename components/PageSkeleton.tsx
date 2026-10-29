"use client";

import { SkeletonText } from "@carbon/react";

export function PageSkeleton() {
  return (
    <main className="app-content page-container" aria-busy="true">
      <SkeletonText heading width="40%" />
      <SkeletonText paragraph lineCount={4} />
    </main>
  );
}
