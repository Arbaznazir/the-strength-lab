"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Pin, Sparkles, Trash2 } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "@/lib/api";
import type { Thread } from "@/lib/types";

export function ThreadModBar({
  thread,
  onUpdated,
}: {
  thread: Thread;
  onUpdated: (patch: Partial<Thread>) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function patch(body: Record<string, boolean>) {
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/admin/threads/${thread.slug}`, {
        method: "PATCH",
        body,
      });
      onUpdated({
        isLocked: body.isLocked ?? thread.isLocked,
        isPinned: body.isPinned ?? thread.isPinned,
        isFeatured: body.isFeatured ?? thread.isFeatured,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeThread() {
    if (!confirm(`Delete thread "${thread.title}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await apiFetch(`/admin/threads/${thread.slug}`, { method: "DELETE" });
      router.push(thread.forumSlug ? `/forums/${thread.forumSlug}` : "/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setBusy(false);
    }
  }

  const btn =
    "inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50";

  return (
    <div className="space-y-2 border border-[var(--staff)]/30 bg-[color-mix(in_oklab,var(--staff)_8%,var(--bg-elevated))] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--staff)]">
        Staff controls
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void patch({ isLocked: !thread.isLocked })}
          className={clsx(
            btn,
            thread.isLocked
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-[var(--line)] hover:border-[var(--accent)]",
          )}
        >
          <Lock className="h-3.5 w-3.5" />
          {thread.isLocked ? "Unlock" : "Lock"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void patch({ isPinned: !thread.isPinned })}
          className={clsx(
            btn,
            thread.isPinned
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-[var(--line)] hover:border-[var(--accent)]",
          )}
        >
          <Pin className="h-3.5 w-3.5" />
          {thread.isPinned ? "Unpin" : "Pin"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void patch({ isFeatured: !thread.isFeatured })}
          className={clsx(
            btn,
            thread.isFeatured
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-[var(--line)] hover:border-[var(--accent)]",
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {thread.isFeatured ? "Unfeature" : "Feature"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void removeThread()}
          className={clsx(btn, "border-[var(--danger)]/40 text-[var(--danger)] hover:bg-[var(--danger)]/10")}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete thread
        </button>
      </div>
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
