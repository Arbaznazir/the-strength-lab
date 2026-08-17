"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Attachment, Category, Forum, Thread } from "@/lib/types";
import {
  ThreadFilters,
  ThreadList,
  type ThreadFilter,
  type ThreadSort,
} from "@/components/ThreadList";
import { Sidebar } from "@/components/Sidebar";
import { Pagination } from "@/components/Pagination";
import { ImageAttach } from "@/components/ImageAttach";
import { MentionInput } from "@/components/MentionInput";
import {
  mapSponsorsToForums,
  SponsorBannerMedia,
  type SponsorBanner,
} from "@/components/ForumList";

type ForumResponse = {
  forum: Forum;
  threads: Thread[];
  page: number;
  pages: number;
  total: number;
};

export default function ForumPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [forum, setForum] = useState<Forum | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<ThreadSort>("last_activity");
  const [filter, setFilter] = useState<ThreadFilter>("");
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [sponsor, setSponsor] = useState<SponsorBanner | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({
        page: String(page),
        sort,
      });
      if (filter) qs.set("filter", filter);
      const data = await apiFetch<ForumResponse>(
        `/forums/${slug}?${qs.toString()}`,
        { auth: false },
      );
      setForum(data.forum);
      setThreads(data.threads ?? []);
      setPages(data.pages || 1);
      setTotal(data.total ?? data.threads?.length ?? 0);
      // If API clamped the page (e.g. stale UI asked for page 2), sync state
      if (data.page && data.page !== page) {
        setPage(data.page);
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load forum");
    }
  }, [slug, page, sort, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!forum?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const [forumData, sponsorData] = await Promise.all([
          apiFetch<{ categories: Category[] }>("/forums", { auth: false }),
          apiFetch<{ banners: SponsorBanner[] }>("/sponsor-banners", {
            auth: false,
          }).catch(() => ({ banners: [] as SponsorBanner[] })),
        ]);
        if (cancelled) return;
        const allForums = (forumData.categories ?? []).flatMap(
          (c) => c.forums ?? [],
        );
        const mapped = mapSponsorsToForums(
          allForums,
          sponsorData.banners ?? [],
        );
        setSponsor(mapped[forum.id] ?? null);
      } catch {
        if (!cancelled) setSponsor(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [forum?.id]);

  async function createThread(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ id: string; slug: string }>(
        `/forums/${slug}/threads`,
        {
          method: "POST",
          body: {
            title,
            body,
            attachmentIds: attachments.map((a) => a.id),
          },
        },
      );
      router.push(`/threads/${res.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create thread");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container-lab space-y-8 py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-6">
        <div>
          <p className="kicker">
            <Link href="/" className="hover:text-[var(--accent)]">
              Home
            </Link>
            <span className="mx-2 opacity-40">›</span>
            <Link href="/#forums" className="hover:text-[var(--accent)]">
              Forums
            </Link>
            {forum ? (
              <>
                <span className="mx-2 opacity-40">›</span>
                <span>{forum.name}</span>
              </>
            ) : null}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {forum?.name ?? "Forum"}
          </h1>
          {forum?.description ? (
            <p className="mt-2 max-w-2xl text-[var(--muted)]">{forum.description}</p>
          ) : null}
        </div>
        {user ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/new-post?forum=${encodeURIComponent(slug)}`}
              className="btn-primary"
            >
              New post
            </Link>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? "Cancel quick post" : "Quick post here"}
            </button>
          </div>
        ) : (
          <Link
            href={`/login?next=${encodeURIComponent(`/new-post?forum=${slug}`)}`}
            className="btn-primary"
          >
            New post
          </Link>
        )}
      </div>

      {sponsor ? (
        <div className="min-w-0">
          <SponsorBannerMedia banner={sponsor} />
          {sponsor.threadSlug ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Official post:{" "}
              <Link
                href={`/threads/${sponsor.threadSlug}`}
                className="font-medium text-[var(--fg)] hover:text-[var(--accent)]"
              >
                {sponsor.threadTitle || sponsor.name}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {showForm && user ? (
        <form
          onSubmit={(e) => void createThread(e)}
          className="space-y-3 border border-[var(--line)] bg-[var(--bg-elevated)] p-5"
        >
          <input
            className="field w-full"
            placeholder="Thread title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={3}
          />
          <MentionInput
            value={body}
            onChange={setBody}
            placeholder="Write your opening post… (@ to mention)"
            rows={6}
            multiline
            required
            excludeUsername={user.username}
          />
          <ImageAttach
            attachments={attachments}
            onChange={setAttachments}
            disabled={submitting}
          />
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Posting…" : "Post thread"}
          </button>
        </form>
      ) : null}

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_13rem] md:gap-6 lg:grid-cols-[minmax(0,1fr)_16.5rem] lg:gap-12">
        <div className="min-w-0 space-y-4 overflow-x-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-[var(--muted)]">
              {total || threads.length} thread{(total || threads.length) === 1 ? "" : "s"}
              {pages > 1 ? ` · page ${page} of ${pages}` : ""}
            </span>

            <ThreadFilters
              sort={sort}
              filter={filter}
              onChange={({ sort: s, filter: f }) => {
                setSort(s);
                setFilter(f);
                setPage(1);
              }}
            />
          </div>

          <ThreadList threads={threads} />

          <Pagination
            page={page}
            pages={pages}
            total={total || threads.length}
            onPage={setPage}
            className="mt-2"
          />
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
