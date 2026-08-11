"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { UserPublic } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { RoleBadge } from "@/components/TagBadge";

export default function OnlinePage() {
  const [members, setMembers] = useState<UserPublic[]>([]);
  const [guests, setGuests] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<{
          members: UserPublic[];
          guests: number;
          total: number;
        }>("/online", { auth: false });
        setMembers(data.members);
        setGuests(data.guests);
        setTotal(data.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
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
          online · {members.length} members · {guests} guests
        </p>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <ul className="divide-y divide-[var(--line)] overflow-hidden border border-[var(--line)] bg-[var(--bg-elevated)]">
        {members.length ? (
          members.map((m) => (
            <li key={m.id}>
              <Link
                href={`/members/${m.username}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--accent-dim)]"
              >
                <span className="relative">
                  <Avatar user={m} size="md" link={false} />
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-elevated)] bg-[var(--accent)]" />
                </span>
                <div>
                  <p className="font-medium">{m.displayName}</p>
                  {m.title ? (
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{m.title}</p>
                  ) : null}
                  <div className="mt-1">
                    <RoleBadge role={m.role} />
                  </div>
                </div>
              </Link>
            </li>
          ))
        ) : (
          <li className="px-4 py-6 text-sm text-[var(--muted)]">
            No members currently online.
          </li>
        )}
      </ul>
    </div>
  );
}
