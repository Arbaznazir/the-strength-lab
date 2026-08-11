"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import clsx from "clsx";
import type { UserPublic } from "@/lib/types";
import { NewestMembersGrid } from "./MemberPanels";

export type MembersView =
  | "overview"
  | "messages"
  | "reactions"
  | "points"
  | "staff";

const navItems: { view: MembersView; label: string; shortLabel?: string }[] = [
  { view: "overview", label: "Overview" },
  { view: "messages", label: "Most messages", shortLabel: "Messages" },
  { view: "reactions", label: "Highest reaction score", shortLabel: "Reactions" },
  { view: "points", label: "Most points", shortLabel: "Points" },
  { view: "staff", label: "Staff members", shortLabel: "Staff" },
];

export function MembersSidebar({
  active,
  newest,
  initialQuery = "",
}: {
  active: MembersView;
  newest: UserPublic[];
  initialQuery?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length >= 2) {
      router.push(`/members?view=overview&q=${encodeURIComponent(q)}`);
    } else if (!q) {
      router.push("/members");
    }
  }

  return (
    <aside className="space-y-4 md:sticky md:top-24 md:self-start">
      <nav className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
        <ul className="flex gap-2 md:hidden">
          {navItems.map((item) => (
            <li key={item.view} className="shrink-0">
              <Link
                href={
                  item.view === "overview"
                    ? "/members"
                    : `/members?view=${item.view}`
                }
                className={clsx(
                  "inline-block whitespace-nowrap border px-3 py-1.5 text-xs font-medium transition-colors",
                  active === item.view
                    ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]"
                    : "border-[var(--line)] text-[var(--muted)]",
                )}
              >
                {item.shortLabel ?? item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <nav className="hidden border border-[var(--line)] bg-[var(--bg-elevated)] md:block">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <p className="kicker">Members</p>
        </div>
        <ul className="py-1">
          {navItems.map((item) => (
            <li key={item.view}>
              <Link
                href={
                  item.view === "overview"
                    ? "/members"
                    : `/members?view=${item.view}`
                }
                className={clsx(
                  "block px-4 py-2.5 text-sm transition-colors",
                  active === item.view
                    ? "bg-[var(--accent-dim)] font-medium text-[var(--accent)]"
                    : "text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)]",
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border border-[var(--line)] bg-[var(--bg-elevated)] p-4">
        <p className="mb-2 text-xs font-semibold">Find member</p>
        <form onSubmit={submitSearch} className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
          <input
            className="field w-full py-2 pl-9 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or username…"
          />
        </form>
      </div>

      {newest.length ? (
        <div className="hidden border border-[var(--line)] bg-[var(--bg-elevated)] p-4 md:block">
          <p className="mb-3 text-xs font-semibold">Newest members</p>
          <NewestMembersGrid members={newest} />
        </div>
      ) : null}
    </aside>
  );
}
