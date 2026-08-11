"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { relativeTime } from "@/lib/format";

type LogRow = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  actor: string;
  createdAt: string;
};

export default function AdminLogPage() {
  const [actions, setActions] = useState<LogRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<{ actions: LogRow[] }>("/admin/log?limit=100");
        setActions(data.actions);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load log");
      }
    })();
  }, []);

  if (error) return <p className="text-sm text-[var(--danger)]">{error}</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Moderation log</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Audit trail of staff actions on the forum.
        </p>
      </div>
      <ul className="divide-y divide-[var(--line)] border border-[var(--line)] bg-[var(--bg-elevated)]">
        {actions.map((row) => (
          <li key={row.id} className="px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-medium">{row.action}</span>
                <span className="text-[var(--muted)]">
                  {" "}
                  · {row.targetType} · @{row.actor}
                </span>
              </span>
              <span className="text-xs text-[var(--muted)]">
                {relativeTime(row.createdAt)}
              </span>
            </div>
            {row.reason ? (
              <p className="mt-1 text-xs text-[var(--muted)]">{row.reason}</p>
            ) : null}
          </li>
        ))}
      </ul>
      {!actions.length ? (
        <p className="text-sm text-[var(--muted)]">No actions logged yet.</p>
      ) : null}
    </div>
  );
}
