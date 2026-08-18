"use client";

import { Sidebar } from "@/components/Sidebar";
import { TrustedStoresBoard } from "@/components/TrustedStores";

export default function SponsorsPage() {
  return (
    <div className="container-lab space-y-8 py-8 sm:py-10">
      <div>
        <p className="kicker">Partners</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Sponsors
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          Lab-vetted shops and partners. Tap a sponsor to open their forum
          threads and banner — store links stay inside each hub.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_13rem] md:gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8">
        <div className="min-w-0">
          <TrustedStoresBoard showHeading={false} />
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
