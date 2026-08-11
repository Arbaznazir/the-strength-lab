"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Image as ImageIcon, Link2, MessageSquareText, Scan } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Attachment, Category } from "@/lib/types";
import { ImageAttach } from "@/components/ImageAttach";
import { MentionInput } from "@/components/MentionInput";

type PostKind = "discussion" | "photos" | "link" | "form_check";

const KINDS: {
  id: PostKind;
  label: string;
  desc: string;
  icon: typeof MessageSquareText;
  preferForum?: string;
}[] = [
  {
    id: "discussion",
    label: "Discussion",
    desc: "Normal forum thread — questions, takes, journals.",
    icon: MessageSquareText,
  },
  {
    id: "photos",
    label: "With photos",
    desc: "Upload images and write it up.",
    icon: ImageIcon,
  },
  {
    id: "link",
    label: "Link post",
    desc: "Share a URL with optional notes.",
    icon: Link2,
  },
  {
    id: "form_check",
    label: "Form check",
    desc: "Photos or video notes for technique feedback.",
    icon: Scan,
    preferForum: "technique",
  },
];

function NewPostForm() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetForum = searchParams.get("forum") || "";

  const [categories, setCategories] = useState<Category[]>([]);
  const [kind, setKind] = useState<PostKind>("discussion");
  const [forumSlug, setForumSlug] = useState(presetForum);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent("/new-post")}`);
    }
  }, [user, loading, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ categories: Category[] }>("/forums", {
          auth: false,
        });
        if (!cancelled) setCategories(data.categories ?? []);
      } catch {
        if (!cancelled) setError("Could not load forums");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const forums = useMemo(
    () =>
      categories.flatMap((c) =>
        (c.forums ?? []).map((f) => ({
          ...f,
          categoryName: c.name,
        })),
      ),
    [categories],
  );

  useEffect(() => {
    if (forumSlug || !forums.length) return;
    const prefer = KINDS.find((k) => k.id === kind)?.preferForum;
    const match = prefer
      ? forums.find((f) => f.slug === prefer)
      : undefined;
    setForumSlug(match?.slug || forums[0]?.slug || "");
  }, [forums, forumSlug, kind]);

  function onPickKind(next: PostKind) {
    setKind(next);
    const prefer = KINDS.find((k) => k.id === next)?.preferForum;
    if (prefer && forums.some((f) => f.slug === prefer)) {
      setForumSlug(prefer);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !forumSlug) return;
    setError("");

    let finalBody = body.trim();
    if (kind === "link") {
      const url = linkUrl.trim();
      if (!/^https?:\/\//i.test(url)) {
        setError("Link must start with http:// or https://");
        return;
      }
      finalBody = finalBody ? `${url}\n\n${finalBody}` : url;
    }
    if (kind === "photos" || kind === "form_check") {
      if (!attachments.length) {
        setError(
          kind === "form_check"
            ? "Add at least one photo for a form check"
            : "Add at least one photo",
        );
        return;
      }
    }
    if (finalBody.length < 2) {
      setError("Write a short opening post");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{ id: string; slug: string }>(
        `/forums/${forumSlug}/threads`,
        {
          method: "POST",
          body: {
            title: title.trim(),
            body: finalBody,
            attachmentIds: attachments.map((a) => a.id),
          },
        },
      );
      router.push(`/threads/${res.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create post");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return (
      <p className="text-sm text-[var(--muted)]">
        {loading ? "Checking session…" : "Redirecting to log in…"}
      </p>
    );
  }

  const kindMeta = KINDS.find((k) => k.id === kind)!;

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-8">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">What are you posting?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {KINDS.map((k) => {
            const Icon = k.icon;
            const active = kind === k.id;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => onPickKind(k.id)}
                className={clsx(
                  "flex items-start gap-3 border px-3 py-3 text-left transition-colors",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-dim)]"
                    : "border-[var(--line)] bg-[var(--bg-elevated)] hover:border-[var(--accent)]/50",
                )}
              >
                <Icon
                  className={clsx(
                    "mt-0.5 h-4 w-4 shrink-0",
                    active ? "text-[var(--accent)]" : "text-[var(--muted)]",
                  )}
                />
                <span>
                  <span className="block text-sm font-semibold">{k.label}</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    {k.desc}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <label className="text-sm font-semibold" htmlFor="forum">
          Forum
        </label>
        <select
          id="forum"
          className="field w-full"
          value={forumSlug}
          onChange={(e) => setForumSlug(e.target.value)}
          required
        >
          {!forums.length ? <option value="">Loading forums…</option> : null}
          {categories.map((c) => (
            <optgroup key={c.id} label={c.name}>
              {(c.forums ?? []).map((f) => (
                <option key={f.id} value={f.slug}>
                  {f.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="text-xs text-[var(--muted)]">
          Posting as {kindMeta.label.toLowerCase()}
          {forumSlug ? (
            <>
              {" "}
              in{" "}
              <Link
                href={`/forums/${forumSlug}`}
                className="text-[var(--accent)] hover:underline"
              >
                {forums.find((f) => f.slug === forumSlug)?.name ?? forumSlug}
              </Link>
            </>
          ) : null}
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold" htmlFor="title">
          Title
        </label>
        <input
          id="title"
          className="field w-full"
          placeholder={
            kind === "form_check"
              ? "e.g. High-bar squat — sticking point?"
              : kind === "link"
                ? "e.g. Solid article on RPE for beginners"
                : "Clear, specific title"
          }
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={3}
          maxLength={200}
        />
      </div>

      {kind === "link" ? (
        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor="link">
            Link URL
          </label>
          <input
            id="link"
            type="url"
            className="field w-full"
            placeholder="https://"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            required
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-sm font-semibold" htmlFor="body">
          {kind === "link" ? "Notes (optional)" : "Opening post"}
        </label>
        <MentionInput
          value={body}
          onChange={setBody}
          placeholder={
            kind === "form_check"
              ? "What lift, what feels off, what you want checked… (@ to mention)"
              : kind === "link"
                ? "Why this link matters (optional)"
                : "Write your post… (@ to mention)"
          }
          rows={8}
          multiline
          required={kind !== "link"}
          excludeUsername={user.username}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">
          {kind === "photos" || kind === "form_check"
            ? "Photos"
            : "Images (optional)"}
        </p>
        <ImageAttach
          attachments={attachments}
          onChange={setAttachments}
          disabled={submitting}
        />
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Posting…" : "Publish post"}
        </button>
        <Link href="/" className="btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}

export default function NewPostPage() {
  return (
    <div className="container-lab max-w-2xl space-y-6 py-8 sm:py-10">
      <div>
        <p className="kicker">Compose</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          New post
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Pick a type, choose a board, add photos or a link if you need them.
        </p>
      </div>
      <Suspense
        fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}
      >
        <NewPostForm />
      </Suspense>
    </div>
  );
}
