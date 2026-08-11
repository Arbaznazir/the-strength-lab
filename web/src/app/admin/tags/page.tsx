"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { TagBadge } from "@/components/TagBadge";

type ProfileTag = {
  slug: string;
  label: string;
  color: string;
  sortOrder: number;
};

export default function AdminTagsPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [tags, setTags] = useState<ProfileTag[]>([]);
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#d4ff3a");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    try {
      const data = await apiFetch<{ tags: ProfileTag[] }>("/admin/tags");
      setTags(data.tags);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tags");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createTag(e: React.FormEvent) {
    e.preventDefault();
    if (!admin || !slug.trim()) return;
    setBusy("create");
    try {
      await apiFetch("/admin/tags", {
        method: "POST",
        body: { slug: slug.trim().toLowerCase(), label: label.trim() || slug, color },
      });
      setSlug("");
      setLabel("");
      setColor("#d4ff3a");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy("");
    }
  }

  async function patchTag(t: ProfileTag, body: Partial<ProfileTag>) {
    setBusy(t.slug);
    try {
      await apiFetch(`/admin/tags/${t.slug}`, { method: "PATCH", body });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy("");
    }
  }

  async function removeTag(slugToDelete: string) {
    if (!confirm(`Delete tag “${slugToDelete}”?`)) return;
    setBusy(slugToDelete);
    try {
      await apiFetch(`/admin/tags/${slugToDelete}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy("");
    }
  }

  if (!admin) {
    return (
      <p className="text-sm text-[var(--muted)]">Only admins can manage profile tags.</p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Profile tags</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Featured-style badges (VIP, Company, Member…). Assign them on the Users page.
          Pick any color.
        </p>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <form
        onSubmit={(e) => void createTag(e)}
        className="flex flex-wrap items-end gap-3 border border-[var(--line)] bg-[var(--bg-elevated)] p-4"
      >
        <label className="space-y-1">
          <span className="text-[10px] uppercase text-[var(--muted)]">Slug</span>
          <input
            className="field block w-28"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="vip"
            required
          />
        </label>
        <label className="min-w-[8rem] flex-1 space-y-1">
          <span className="text-[10px] uppercase text-[var(--muted)]">Label</span>
          <input
            className="field w-full"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="VIP"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase text-[var(--muted)]">Color</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 border border-[var(--line)] bg-[var(--bg)]"
            />
            <TagBadge tag={{ slug: "x", label: label || slug || "Tag", color }} />
          </div>
        </label>
        <button
          type="submit"
          className="btn-primary !px-3 !py-1.5 text-sm"
          disabled={busy === "create"}
        >
          Add tag
        </button>
      </form>

      <ul className="divide-y divide-[var(--line)] border border-[var(--line)] bg-[var(--bg-elevated)]">
        {tags.map((t) => (
          <li
            key={t.slug}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-3">
              <TagBadge tag={t} />
              <span className="text-xs text-[var(--muted)]">@{t.slug}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                value={t.color}
                disabled={busy === t.slug}
                onChange={(e) => void patchTag(t, { color: e.target.value })}
                className="h-8 w-10 border border-[var(--line)] bg-[var(--bg)]"
              />
              <input
                className="border border-[var(--line)] bg-[var(--bg)] px-2 py-1 text-xs"
                defaultValue={t.label}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== t.label) {
                    void patchTag(t, { label: e.target.value.trim() });
                  }
                }}
              />
              <button
                type="button"
                className="border border-[var(--danger)]/40 px-2 py-1 text-xs text-[var(--danger)]"
                onClick={() => void removeTag(t.slug)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
