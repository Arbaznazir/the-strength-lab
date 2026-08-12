"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function OnlinePage() {
  const [guests, setGuests] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiFetch<{ guests: number; total: number }>(
          "/online",
          { auth: false },
        );
        setGuests(data.guests);
        setTotal(data.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    };

    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="container-lab mx-auto max-w-2xl space-y-6 py-8 sm:py-10">
      <div>
        <p className="kicker">Presence</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Currently online
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          <span className="font-semibold text-[var(--accent)]">{total}</span>{" "}
          online · {total - guests} members · {guests} guests
        </p>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="overflow-hidden border border-[var(--line)] bg-[var(--bg-elevated)] px-4 py-6 text-sm text-[var(--muted)]">
        Member identities are not shown publicly. Counts shift throughout the
        day as people browse the forums.
      </div>
    </div>
  );
}
