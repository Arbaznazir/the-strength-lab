"use client";

import { Suspense } from "react";
import ThreadPage from "./ThreadPageInner";

export default function ThreadPageWrapper({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense
      fallback={
        <p className="container-lab py-8 text-[var(--muted)] sm:py-10">
          Loading thread…
        </p>
      }
    >
      <ThreadPage params={params} />
    </Suspense>
  );
}
