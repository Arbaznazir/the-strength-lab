"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiUpload, mediaURL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import type { Category } from "@/lib/types";

type Banner = {
  id: string;
  name: string;
  imageUrl: string;
  linkUrl: string;
  forumId?: string;
  forumSlug?: string;
  forumName?: string;
  sortOrder: number;
  isActive: boolean;
};

const emptyForm = {
  name: "",
  imageUrl: "",
  linkUrl: "",
  forumId: "",
  sortOrder: 0,
  isActive: true,
};

function isVideo(url: string, mime?: string) {
  if (mime?.startsWith("video/")) return true;
  const lower = url.toLowerCase().split("?")[0] ?? "";
  return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov");
}

function previewSrc(url: string) {
  if (!url) return "";
  if (
    url.startsWith("blob:") ||
    url.startsWith("data:") ||
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("/sponsors/") ||
    url.startsWith("/uploads/")
  ) {
    return url;
  }
  return mediaURL(url) || url;
}

function normalizeLink(raw: string) {
  const s = raw.trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function BannerPreview({
  url,
  name,
  mime,
}: {
  url: string;
  name: string;
  mime?: string;
}) {
  const src = previewSrc(url);
  if (!url || !src) return null;
  if (isVideo(url, mime)) {
    return (
      <video
        src={src}
        className="mt-2 max-h-28 w-full border border-[var(--line)] object-contain"
        muted
        autoPlay
        loop
        playsInline
        aria-label={name}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={name || "Banner preview"}
      className="mt-2 max-h-28 w-full border border-[var(--line)] object-contain"
    />
  );
}

export default function AdminSponsorsPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [forums, setForums] = useState<{ id: string; slug: string; name: string }[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [localPreview, setLocalPreview] = useState("");
  const [localMime, setLocalMime] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (localPreview.startsWith("blob:")) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  async function load() {
    try {
      const [s, f] = await Promise.all([
        apiFetch<{ banners: Banner[] }>("/admin/sponsors"),
        apiFetch<{ categories: Category[] }>("/forums", { auth: false }),
      ]);
      setBanners(s.banners);
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

  function clearLocalPreview() {
    setLocalPreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return "";
    });
    setLocalMime("");
  }

  async function createBanner(e: React.FormEvent) {
    e.preventDefault();
    if (!admin) return;
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (uploading) {
      setError("Wait for the banner file to finish uploading");
      return;
    }
    if (!form.imageUrl) {
      setError("Choose a banner file first (GIF / PNG / JPEG / WebP / MP4)");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiFetch("/admin/sponsors", {
        method: "POST",
        body: {
          name: form.name.trim(),
          imageUrl: form.imageUrl,
          linkUrl: normalizeLink(form.linkUrl),
          forumId: form.forumId || undefined,
          sortOrder: form.sortOrder,
          isActive: form.isActive,
        },
      });
      setForm(emptyForm);
      clearLocalPreview();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function patchBanner(id: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      await apiFetch(`/admin/sponsors/${id}`, { method: "PATCH", body });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeBanner(id: string) {
    if (!confirm("Delete this sponsor banner? It will disappear from the homepage.")) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/admin/sponsors/${id}`, { method: "DELETE" });
      setBanners((prev) => prev.filter((b) => b.id !== id));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadBanner(file: File) {
    clearLocalPreview();
    const blobUrl = URL.createObjectURL(file);
    setLocalPreview(blobUrl);
    setLocalMime(file.type);
    setUploading(true);
    setError("");
    setForm((f) => ({ ...f, imageUrl: "" }));
    try {
      const res = await apiUpload(file, "attachment");
      if (!res?.url) throw new Error("Upload returned no URL");
      setForm((f) => ({ ...f, imageUrl: res.url }));
      // Keep blob preview until list reload — server URL may need Next restart for rewrite
    } catch (err) {
      setForm((f) => ({ ...f, imageUrl: "" }));
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (!admin) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Only admins can manage sponsor banners.
      </p>
    );
  }

  const previewUrl = localPreview || form.imageUrl;
  const canSubmit = Boolean(form.name.trim() && form.imageUrl && !uploading && !busy);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Sponsors</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          GIF / MP4 banners shown under forum rows on the homepage. Leave forum
          blank to auto-rotate across boards.
        </p>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <form
        onSubmit={(e) => void createBanner(e)}
        className="space-y-3 border border-[var(--line)] bg-[var(--bg-elevated)] p-4"
      >
        <h3 className="text-sm font-semibold">Add sponsor banner</h3>
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
            <span className="text-[10px] uppercase text-[var(--muted)]">Sort order</span>
            <input
              type="number"
              inputMode="numeric"
              className="field w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              value={form.sortOrder}
              onChange={(e) =>
                setForm({ ...form, sortOrder: Number(e.target.value) || 0 })
              }
            />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-[10px] uppercase text-[var(--muted)]">
              Click URL
            </span>
            <input
              className="field w-full"
              value={form.linkUrl}
              onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
              placeholder="https://example.com"
            />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-[10px] uppercase text-[var(--muted)]">
              Assign to forum (optional)
            </span>
            <select
              className="field w-full"
              value={form.forumId}
              onChange={(e) => setForm({ ...form, forumId: e.target.value })}
            >
              <option value="">Auto-rotate</option>
              {forums.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-2 text-sm sm:col-span-2">
            <span className="text-[10px] uppercase text-[var(--muted)]">
              Banner file (GIF / PNG / JPEG / WebP / MP4) — required
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <label className="btn-primary relative inline-flex cursor-pointer !px-4 !py-2 text-sm">
                Choose file
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,.jpg,.jpeg,.png,.gif,.webp,.mp4"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadBanner(file);
                  }}
                />
              </label>
              <span className="min-w-0 truncate text-xs text-[var(--muted)]">
                {uploading
                  ? "Uploading…"
                  : form.imageUrl
                    ? "File uploaded — ready to add"
                    : "No file chosen"}
              </span>
            </div>
            <BannerPreview
              url={previewUrl}
              name={form.name || "Banner preview"}
              mime={localMime}
            />
          </div>
        </div>
        <button
          type="submit"
          className="btn-primary !px-4 !py-2 text-sm"
          disabled={busy || uploading}
        >
          {busy ? "Saving…" : uploading ? "Uploading…" : "Add banner"}
        </button>
        {!canSubmit && !busy && !uploading ? (
          <p className="text-xs text-[var(--muted)]">
            {!form.imageUrl
              ? "Button needs a uploaded banner file first."
              : !form.name.trim()
                ? "Enter a name."
                : null}
          </p>
        ) : null}
      </form>

      <ul className="divide-y divide-[var(--line)] border border-[var(--line)] bg-[var(--bg-elevated)]">
        {banners.map((b) => (
          <li key={b.id} className="space-y-3 px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{b.name}</span>
              {!b.isActive ? (
                <span className="text-xs text-[var(--muted)]">Hidden</span>
              ) : null}
              {b.forumName ? (
                <span className="text-xs text-[var(--muted)]">
                  → {b.forumName}
                </span>
              ) : (
                <span className="text-xs text-[var(--muted)]">Auto-rotate</span>
              )}
            </div>
            <BannerPreview url={b.imageUrl} name={b.name} />
            {b.linkUrl ? (
              <p className="truncate text-xs text-[var(--muted)]">{b.linkUrl}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="border border-[var(--line)] px-2 py-1 text-xs hover:border-[var(--accent)]"
                onClick={() => void patchBanner(b.id, { isActive: !b.isActive })}
              >
                {b.isActive ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                className="border border-[var(--danger)]/40 px-2 py-1 text-xs text-[var(--danger)]"
                onClick={() => void removeBanner(b.id)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!banners.length ? (
        <p className="text-sm text-[var(--muted)]">No sponsor banners yet.</p>
      ) : null}
    </div>
  );
}
