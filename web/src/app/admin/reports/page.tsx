"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { relativeTime } from "@/lib/format";

type Report = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  createdAt: string;
  reporter: string;
};

export default function AdminReportsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const isStaff = user?.role === "admin" || user?.role === "moderator";

  async function load() {
    try {
      const data = await apiFetch<{ reports: Report[] }>("/admin/reports");
      setReports(data.reports);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    }
  }

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!isStaff) {
      router.replace("/");
      return;
    }
    void load();
  }, [user, loading, isStaff, router]);

  async function resolve(id: string) {
    setBusy(id);
    try {
      await apiFetch(`/admin/reports/${id}/resolve`, { method: "POST", body: {} });
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resolve");
    } finally {
      setBusy("");
    }
  }

  if (loading || !user) {
    return (
      <p className="container-lab py-8 text-[var(--muted)] sm:py-10">
        Loading…
      </p>
    );
  }

  if (!isStaff) return null;

  return (
    <div className="container-lab mx-auto max-w-3xl space-y-6 py-8 sm:py-10">
      <div>
        <p className="kicker">Staff</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Open reports
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Review community reports and mark them resolved.
        </p>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {reports.length ? (
        <ul className="divide-y divide-[var(--line)] overflow-hidden border border-[var(--line)] bg-[var(--bg-elevated)]">
          {reports.map((r) => (
            <li key={r.id} className="space-y-2 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium capitalize">
                    {r.targetType} · {r.targetId.slice(0, 8)}…
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Reported by @{r.reporter} · {relativeTime(r.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void resolve(r.id)}
                  disabled={busy === r.id}
                  className="btn-primary !px-3 !py-1.5 text-xs"
                >
                  {busy === r.id ? "…" : "Resolve"}
                </button>
              </div>
              <p className="text-sm leading-relaxed text-[var(--fg)]">{r.reason}</p>
              {r.targetType === "post" ? (
                <p className="text-xs text-[var(--muted)]">
                  Open the thread and find post ID in the page source or database.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[var(--muted)]">No open reports. Good job.</p>
      )}

      <Link href="/" className="text-sm text-[var(--accent)] hover:underline">
        ← Back to forums
      </Link>
    </div>
  );
}
