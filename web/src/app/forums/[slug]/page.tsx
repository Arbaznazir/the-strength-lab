"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Attachment, Forum, Thread } from "@/lib/types";
import {
  ThreadFilters,
  ThreadList,
  type ThreadFilter,
  type ThreadSort,
} from "@/components/ThreadList";
import { Sidebar } from "@/components/Sidebar";
import { ImageAttach } from "@/components/ImageAttach";
import { MentionInput } from "@/components/MentionInput";

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
  const [sort, setSort] = useState<ThreadSort>("last_activity");
  const [filter, setFilter] = useState<ThreadFilter>("");
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

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
      setThreads(data.threads);
      setPages(data.pages || 1);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load forum");
    }
  }, [slug, page, sort, filter]);

  useEffect(() => {
    void load();
  }, [load]);

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
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "Cancel" : "New thread"}
          </button>
        ) : (
          <Link href="/login" className="btn-ghost">
            Log in to post
          </Link>
        )}
      </div>

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
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {pages > 1 ? (
              <div className="flex flex-wrap items-center gap-2">
                {Array.from({ length: pages }, (_, idx) => idx + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={
                      n === page
                        ? "min-w-9 border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[var(--accent-ink)]"
                        : "min-w-9 border border-[var(--line)] px-3 py-1.5 text-sm font-semibold hover:border-[var(--accent)]"
                    }
                  >
                    {n}
                  </button>
                ))}
                {page < pages ? (
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    className="border border-[var(--line)] px-3 py-1.5 text-sm font-semibold hover:border-[var(--accent)]"
                  >
                    Next
                  </button>
                ) : null}
              </div>
            ) : (
              <span className="text-sm text-[var(--muted)]">
                {threads.length} thread{threads.length === 1 ? "" : "s"}
              </span>
            )}

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

          <ThreadList
            threads={threads}
            page={page}
            pages={pages}
            onPageChange={setPage}
          />
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
