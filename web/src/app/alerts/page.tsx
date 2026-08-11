"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { relativeTime } from "@/lib/format";
import type { Alert } from "@/lib/types";
import { renderTextWithMentions } from "@/lib/mentions";

export default function AlertsPage() {
  const { user, loading, refresh } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await apiFetch<{ alerts: Alert[] }>("/alerts");
      setAlerts(data.alerts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load alerts");
    }
  }

  useEffect(() => {
    if (!user?.id) return;
    void load();
  }, [user?.id]);

  async function markRead() {
    try {
      await apiFetch("/alerts/read", { method: "POST", body: {} });
      await load();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not mark read");
    }
  }

  if (loading) {
    return (
      <p className="container-lab py-8 text-[var(--muted)] sm:py-10">
        Loading…
      </p>
    );
  }

  if (!user) {
    return (
      <p className="container-lab py-8 text-[var(--muted)] sm:py-10">
        <Link href="/login" className="text-[var(--accent)] hover:underline">
          Log in
        </Link>{" "}
        to view alerts.
      </p>
    );
  }

  return (
    <div className="container-lab mx-auto max-w-2xl space-y-6 py-8 sm:py-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="kicker">Notifications</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Alerts
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Mentions, replies, and reactions.
          </p>
        </div>
        <button type="button" className="btn-ghost text-sm" onClick={() => void markRead()}>
          Mark all read
        </button>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <ul className="divide-y divide-[var(--line)] overflow-hidden border border-[var(--line)] bg-[var(--bg-elevated)]">
        {alerts.length ? (
          alerts.map((a) => {
            const content = (
              <div className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">
                    {!a.isRead ? (
                      <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
                    ) : null}
                    {a.title}
                  </p>
                  <span className="shrink-0 text-xs text-[var(--muted)]">
                    {relativeTime(a.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {renderTextWithMentions(a.body, { linkMentions: !a.link })}
                </p>
              </div>
            );
            return (
              <li
                key={a.id}
                className={
                  a.isRead ? "opacity-70" : "bg-[color-mix(in_oklab,var(--accent)_4%,transparent)]"
                }
              >
                {a.link ? (
                  <Link
                    href={a.link}
                    className="block transition-colors hover:bg-[var(--accent-dim)]"
                  >
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })
        ) : (
          <li className="px-4 py-6 text-sm text-[var(--muted)]">
            You&apos;re all caught up.
          </li>
        )}
      </ul>
    </div>
  );
}
