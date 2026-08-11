"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { relativeTime } from "@/lib/format";

type Dashboard = {
  openReports: number;
  members: number;
  threads: number;
  posts: number;
  banned: number;
  recent: {
    id: string;
    action: string;
    targetType: string;
    targetId: string;
    reason: string;
    actor: string;
    createdAt: string;
  }[];
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch<Dashboard>("/admin/dashboard");
        setData(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      }
    })();
  }, []);

  if (error) {
    return <p className="text-sm text-[var(--danger)]">{error}</p>;
  }

  if (!data) {
    return <p className="text-[var(--muted)]">Loading dashboard…</p>;
  }

  const stats = [
    { label: "Open reports", value: data.openReports, href: "/admin/reports" },
    { label: "Members", value: data.members, href: "/admin/users" },
    { label: "Threads", value: data.threads, href: "/" },
    { label: "Posts", value: data.posts, href: "/" },
    { label: "Banned", value: data.banned, href: "/admin/users" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="border border-[var(--line)] bg-[var(--bg-elevated)] p-4 transition-colors hover:border-[var(--accent)]"
          >
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              {s.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
          </Link>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Recent moderation</h2>
          <Link href="/admin/log" className="text-sm text-[var(--accent)] hover:underline">
            View all
          </Link>
        </div>
        {data.recent.length ? (
          <ul className="divide-y divide-[var(--line)] border border-[var(--line)] bg-[var(--bg-elevated)]">
            {data.recent.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <span className="font-medium">{row.action}</span>
                  <span className="text-[var(--muted)]">
                    {" "}
                    · {row.targetType} · @{row.actor}
                  </span>
                  {row.reason ? (
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{row.reason}</p>
                  ) : null}
                </div>
                <span className="text-xs text-[var(--muted)]">
                  {relativeTime(row.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--muted)]">No moderation actions yet.</p>
        )}
      </section>
    </div>
  );
}
