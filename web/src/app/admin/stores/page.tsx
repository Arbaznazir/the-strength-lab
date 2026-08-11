"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiUpload, mediaURL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { TagBadge } from "@/components/TagBadge";
import type { Forum, Category } from "@/lib/types";

type Store = {
  id: string;
  name: string;
  slug: string;
  tagLabel: string;
  tagColor: string;
  bannerUrl: string;
  linkUrl: string;
  description: string;
  forumId?: string;
  forumSlug?: string;
  sortOrder: number;
  isActive: boolean;
  threadCount: number;
  postCount: number;
};

const emptyForm = {
  name: "",
  slug: "",
  tagLabel: "Trusted Source",
  tagColor: "#d4ff3a",
  bannerUrl: "",
  linkUrl: "",
  description: "",
  forumId: "",
  sortOrder: 0,
  isActive: true,
};

export default function AdminStoresPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [stores, setStores] = useState<Store[]>([]);
  const [forums, setForums] = useState<{ id: string; slug: string; name: string }[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [s, f] = await Promise.all([
        apiFetch<{ stores: Store[] }>("/admin/stores"),
        apiFetch<{ categories: Category[] }>("/forums", { auth: false }),
      ]);
      setStores(s.stores);
      const flat: { id: string; slug: string; name: string }[] = [];
      for (const c of f.categories ?? []) {
        for (const forum of c.forums ?? []) {
          flat.push({ id: forum.id, slug: forum.slug, name: forum.name });
        }
      }
      setForums(flat);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createStore(e: React.FormEvent) {
    e.preventDefault();
    if (!admin) return;
    setBusy(true);
    try {
      await apiFetch("/admin/stores", {
        method: "POST",
        body: {
          ...form,
          forumId: form.forumId || undefined,
        },
      });
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function patchStore(id: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      await apiFetch(`/admin/stores/${id}`, { method: "PATCH", body });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeStore(id: string) {
    if (!confirm("Delete this trusted store?")) return;
    setBusy(true);
    try {
      await apiFetch(`/admin/stores/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadBanner(file: File) {
    try {
      const res = await apiUpload(file, "attachment");
      setForm((f) => ({ ...f, bannerUrl: res.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  if (!admin) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Only admins can manage trusted stores.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Trusted stores</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          These appear under Trending and as a board on the home page — with banners,
          tags, and forum stats.
        </p>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <form
        onSubmit={(e) => void createStore(e)}
        className="space-y-3 border border-[var(--line)] bg-[var(--bg-elevated)] p-4"
      >
        <h3 className="text-sm font-semibold">Add store</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-[10px] uppercase text-[var(--muted)]">Name</span>
            <input
              className="field w-full"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[10px] uppercase text-[var(--muted)]">Slug</span>
            <input
              className="field w-full"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="auto from name"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[10px] uppercase text-[var(--muted)]">Tag label</span>
            <input
              className="field w-full"
              value={form.tagLabel}
              onChange={(e) => setForm({ ...form, tagLabel: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[10px] uppercase text-[var(--muted)]">Tag color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.tagColor}
                onChange={(e) => setForm({ ...form, tagColor: e.target.value })}
                className="h-9 w-12 cursor-pointer border border-[var(--line)] bg-[var(--bg)]"
              />
              <TagBadge
                tag={{ slug: "preview", label: form.tagLabel || "Trusted", color: form.tagColor }}
              />
            </div>
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-[10px] uppercase text-[var(--muted)]">External link</span>
            <input
              className="field w-full"
              value={form.linkUrl}
              onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
              placeholder="https://…"
            />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-[10px] uppercase text-[var(--muted)]">
              Linked forum (for topics/posts/last post)
            </span>
            <select
              className="field w-full"
              value={form.forumId}
              onChange={(e) => setForm({ ...form, forumId: e.target.value })}
            >
              <option value="">None</option>
              {forums.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-[10px] uppercase text-[var(--muted)]">Description</span>
            <input
              className="field w-full"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-[10px] uppercase text-[var(--muted)]">Banner</span>
            <input
              type="file"
              accept="image/*"
              className="block w-full text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadBanner(file);
              }}
            />
            {form.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaURL(form.bannerUrl) || form.bannerUrl}
                alt=""
                className="mt-2 max-h-24 border border-[var(--line)] object-cover"
              />
            ) : null}
          </label>
        </div>
        <button type="submit" className="btn-primary !px-4 !py-2 text-sm" disabled={busy}>
          Add store
        </button>
      </form>

      <ul className="divide-y divide-[var(--line)] border border-[var(--line)] bg-[var(--bg-elevated)]">
        {stores.map((s) => (
          <li key={s.id} className="space-y-3 px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{s.name}</span>
              <TagBadge
                tag={{ slug: s.slug, label: s.tagLabel, color: s.tagColor }}
              />
              {!s.isActive ? (
                <span className="text-xs text-[var(--muted)]">Hidden</span>
              ) : null}
            </div>
            {s.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaURL(s.bannerUrl) || s.bannerUrl}
                alt=""
                className="max-h-20 border border-[var(--line)] object-cover"
              />
            ) : null}
            <p className="text-xs text-[var(--muted)]">
              {s.threadCount} topics · {s.postCount} posts
              {s.forumSlug ? ` · forum /${s.forumSlug}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-1.5 text-xs">
                Color
                <input
                  type="color"
                  value={s.tagColor}
                  onChange={(e) =>
                    void patchStore(s.id, { tagColor: e.target.value })
                  }
                  className="h-7 w-10 border border-[var(--line)] bg-[var(--bg)]"
                />
              </label>
              <button
                type="button"
                className="border border-[var(--line)] px-2 py-1 text-xs hover:border-[var(--accent)]"
                onClick={() => void patchStore(s.id, { isActive: !s.isActive })}
              >
                {s.isActive ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                className="border border-[var(--danger)]/40 px-2 py-1 text-xs text-[var(--danger)]"
                onClick={() => void removeStore(s.id)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!stores.length ? (
        <p className="text-sm text-[var(--muted)]">No trusted stores yet.</p>
      ) : null}
    </div>
  );
}
