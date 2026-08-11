"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { AdminPagination } from "@/components/admin/AdminPagination";

type Report = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  createdAt: string;
  reporter: string;
  resolvedAt?: string;
  resolvedBy?: string;
  targetPreview?: string;
  targetLink?: string;
  threadSlug?: string;
  threadTitle?: string;
};

type ReportStatus = "open" | "resolved";

const PAGE_SIZE = 20;

export default function AdminReportsPage() {
  const [status, setStatus] = useState<ReportStatus>("open");
  const [page, setPage] = useState(1);
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function load(nextStatus = status, nextPage = page) {
    try {
      const params = new URLSearchParams({
        status: nextStatus,
        page: String(nextPage),
        limit: String(PAGE_SIZE),
      });
      const data = await apiFetch<{ reports: Report[]; total: number }>(
        `/admin/reports?${params}`,
      );
      setReports(data.reports);
      setTotal(data.total);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    }
  }

  useEffect(() => {
    void load(status, page);
  }, [status, page]);

  async function resolve(id: string) {
    setBusy(id);
    try {
      await apiFetch(`/admin/reports/${id}/resolve`, { method: "POST", body: {} });
      await load(status, page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resolve");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Reports</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Review flagged content and mark reports resolved when handled.
          </p>
        </div>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Show</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ReportStatus);
              setPage(1);
            }}
            className="block border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm"
          >
            <option value="open">Open reports</option>
            <option value="resolved">Resolved log</option>
          </select>
        </label>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {reports.length ? (
        <ul className="divide-y divide-[var(--line)] overflow-hidden border border-[var(--line)] bg-[var(--bg-elevated)]">
          {reports.map((r) => (
            <li key={r.id} className="space-y-2 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium capitalize">
                    {r.targetType}
                    {r.threadTitle ? (
                      <span className="font-normal text-[var(--muted)]">
                        {" "}
                        · {r.threadTitle}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Reported by @{r.reporter} · {relativeTime(r.createdAt)}
                    {status === "resolved" && r.resolvedBy ? (
                      <>
                        {" "}
                        · Resolved by @{r.resolvedBy}
                        {r.resolvedAt ? ` · ${relativeTime(r.resolvedAt)}` : ""}
                      </>
                    ) : null}
                  </p>
                </div>
                {status === "open" ? (
                  <button
                    type="button"
                    onClick={() => void resolve(r.id)}
                    disabled={busy === r.id}
                    className="btn-primary !px-3 !py-1.5 text-xs"
                  >
                    {busy === r.id ? "…" : "Resolve"}
                  </button>
                ) : (
                  <span className="rounded bg-[var(--accent-dim)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--accent)]">
                    Resolved
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed">{r.reason}</p>
              {r.targetPreview ? (
                <p className="border-l-2 border-[var(--line)] pl-3 text-sm text-[var(--muted)]">
                  {r.targetPreview}
                </p>
              ) : null}
              {r.targetLink ? (
                <Link
                  href={r.targetLink}
                  className="inline-block text-sm font-medium text-[var(--accent)] hover:underline"
                >
                  View content →
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[var(--muted)]">
          {status === "open" ? "No open reports." : "No resolved reports yet."}
        </p>
      )}

      <AdminPagination
        page={page}
        total={total}
        limit={PAGE_SIZE}
        onPage={setPage}
      />
    </div>
  );
}
