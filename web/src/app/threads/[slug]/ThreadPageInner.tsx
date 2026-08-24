"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bell, BellOff, Lock, Share2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Attachment, Post, Thread } from "@/lib/types";
import { PostCard } from "@/components/PostCard";
import { ThreadModBar } from "@/components/admin/ThreadModBar";
import { isStaff } from "@/lib/admin";
import { PAGE_SIZE } from "@/lib/pagination";
import { ImageAttach } from "@/components/ImageAttach";
import { ShareModal } from "@/components/ShareModal";
import { ShareBar } from "@/components/ShareBar";
import { SocialLinks } from "@/components/SocialLinks";
import { MentionInput } from "@/components/MentionInput";
import { threadShareURL } from "@/lib/site";
import {
  SponsorStoreBanner,
  externalStoreHref,
  useTrustedStores,
  type TrustedStore,
} from "@/components/TrustedStores";

function postIdFromHash() {
  if (typeof window === "undefined") return "";
  const m = window.location.hash.match(/^#post-(.+)$/);
  return m?.[1] ?? "";
}

function matchSponsorStore(
  slug: string,
  title: string | undefined,
  stores: TrustedStore[],
): TrustedStore | null {
  const byThread = stores.find((s) => s.threadSlug && s.threadSlug === slug);
  if (byThread) return byThread;
  const byOfficial = stores.find((s) => slug === `official-${s.slug}`);
  if (byOfficial) return byOfficial;
  const key = title?.trim().toLowerCase() ?? "";
  if (!key) return null;
  return (
    stores.find((s) => key.includes(s.name.trim().toLowerCase())) ?? null
  );
}

export default function ThreadPageInner({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const staff = isStaff(user);
  const { stores } = useTrustedStores();
  const [thread, setThread] = useState<Thread | null>(null);
  const [openingPost, setOpeningPost] = useState<Post | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [totalPosts, setTotalPosts] = useState(0);
  const [reply, setReply] = useState("");
  const [quotedPostId, setQuotedPostId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [watched, setWatched] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const replyRef = useRef<HTMLFormElement>(null);
  const pendingHashRef = useRef<string>("");

  const load = useCallback(async (pageNum: number, postId?: string) => {
    try {
      const qs = new URLSearchParams();
      if (postId) qs.set("postId", postId);
      else qs.set("page", String(pageNum));
      const data = await apiFetch<{
        thread: Thread;
        openingPost?: Post | null;
        posts: Post[];
        page: number;
        pages: number;
        totalPosts: number;
        watched: boolean;
      }>(`/threads/${slug}?${qs.toString()}`);
      setThread(data.thread);
      setOpeningPost(data.openingPost ?? null);
      setPosts(data.posts);
      setPage(data.page);
      setPages(data.pages);
      setTotalPosts(data.totalPosts);
      setWatched(data.watched);
      setError("");
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load thread");
      return null;
    }
  }, [slug]);

  useEffect(() => {
    const hashPost = postIdFromHash();
    pendingHashRef.current = hashPost;
    const pageParam = searchParams.get("page");
    const initialPage = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
    void (async () => {
      const data = await load(hashPost ? 1 : initialPage, hashPost || undefined);
      if (data && hashPost) setPage(data.page);
    })();
  }, [slug, searchParams, load]);

  useEffect(() => {
    const hashPost = pendingHashRef.current || postIdFromHash();
    if (!hashPost || (!openingPost && !posts.length)) return;
    const el = document.getElementById(`post-${hashPost}`);
    if (el) {
      window.requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-[var(--accent)]");
        window.setTimeout(() => {
          el.classList.remove("ring-2", "ring-[var(--accent)]");
        }, 2500);
      });
      pendingHashRef.current = "";
    }
  }, [posts, openingPost, page]);

  function scrollToReply(prefill?: string, quoteId?: string) {
    if (prefill) setReply(prefill);
    if (quoteId) setQuotedPostId(quoteId);
    replyRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !reply.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/threads/${slug}/replies`, {
        method: "POST",
        body: {
          body: reply,
          attachmentIds: attachments.map((a) => a.id),
          quotedPostId: quotedPostId ?? undefined,
        },
      });
      setReply("");
      setQuotedPostId(null);
      setAttachments([]);
      // Newest-first: jump to page 1 so the new reply is visible at the top
      await load(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reply failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleWatch() {
    if (!user) return;
    setBusy(true);
    try {
      if (watched) {
        await apiFetch(`/threads/${slug}/watch`, { method: "DELETE" });
        setWatched(false);
      } else {
        await apiFetch(`/threads/${slug}/watch`, { method: "POST", body: {} });
        setWatched(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update watch");
    } finally {
      setBusy(false);
    }
  }

  const sponsorStore = matchSponsorStore(slug, thread?.title, stores);
  const sponsorHref = externalStoreHref(sponsorStore?.linkUrl);

  return (
    <div className="container-lab mx-auto max-w-4xl space-y-6 py-8 sm:py-10">
      {sponsorStore?.bannerUrl ? (
        <SponsorStoreBanner store={sponsorStore} linkToStore />
      ) : null}
      <div className="border-b border-[var(--line)] pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="kicker">
            <Link href="/#forums" className="hover:text-[var(--accent)]">
              Forums
            </Link>
            {thread?.forumSlug ? (
              <>
                <span className="mx-2 opacity-40">/</span>
                <Link
                  href={`/forums/${thread.forumSlug}`}
                  className="hover:text-[var(--accent)]"
                >
                  {thread.forumName}
                </Link>
              </>
            ) : null}
          </p>
          <SocialLinks variant="header" className="hidden sm:flex" />
        </div>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            {sponsorHref ? (
              <a
                href={sponsorHref}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="group block max-w-3xl"
              >
                <h1 className="text-xl font-semibold leading-snug tracking-tight transition-colors group-hover:text-[var(--accent)] sm:text-2xl">
                  {thread?.title ?? "Thread"}
                </h1>
              </a>
            ) : (
              <h1 className="max-w-3xl text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
                {thread?.title ?? "Thread"}
              </h1>
            )}
            {thread ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                <Link
                  href={`/members/${thread.author.username}`}
                  className="hover:text-[var(--accent)] hover:underline"
                >
                  {thread.author.displayName}
                </Link>
                {totalPosts > 0 ? (
                  <span className="ml-2 opacity-60">· {totalPosts} posts</span>
                ) : null}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="btn-ghost !px-3 !py-2 text-xs"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
            {thread?.isLocked ? (
              <span className="inline-flex items-center gap-1 border border-[var(--line)] px-2.5 py-1.5 text-xs text-[var(--muted)]">
                <Lock className="h-3.5 w-3.5" />
                Locked
              </span>
            ) : null}
            {user ? (
              <button
                type="button"
                onClick={() => void toggleWatch()}
                disabled={busy}
                className="btn-ghost !px-3 !py-2 text-xs"
              >
                {watched ? (
                  <BellOff className="h-3.5 w-3.5" />
                ) : (
                  <Bell className="h-3.5 w-3.5" />
                )}
                {watched ? "Unwatch" : "Watch"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {thread && staff ? (
        <ThreadModBar
          thread={thread}
          onUpdated={(patch) => setThread((t) => (t ? { ...t, ...patch } : t))}
        />
      ) : null}

      {pages > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => void load(n)}
              className={
                n === page
                  ? "min-w-9 border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[var(--accent-ink)]"
                  : "min-w-9 border border-[var(--line)] px-3 py-1.5 text-sm font-semibold hover:border-[var(--accent)]"
              }
            >
              {n}
            </button>
          ))}
        </div>
      ) : null}

      <div className="space-y-4">
        {openingPost ? (
          <PostCard
            key={openingPost.id}
            post={openingPost}
            index={0}
            threadSlug={slug}
            threadTitle={thread?.title}
            canReply={Boolean(user && (!thread?.isLocked || staff))}
            onReply={(p) =>
              scrollToReply(`@${p.author.username} `, undefined)
            }
            onQuote={(p) =>
              scrollToReply(
                `> ${p.body.split("\n").join("\n> ")}\n\n`,
                p.id,
              )
            }
            onDeleted={() => void load(page)}
          />
        ) : null}
        {posts.map((post, i) => (
          <PostCard
            key={post.id}
            post={post}
            index={Math.max(
              1,
              totalPosts - ((page - 1) * PAGE_SIZE + i) - 1,
            )}
            threadSlug={slug}
            threadTitle={thread?.title}
            canReply={Boolean(user && (!thread?.isLocked || staff))}
            onReply={(p) =>
              scrollToReply(`@${p.author.username} `, undefined)
            }
            onQuote={(p) =>
              scrollToReply(
                `> ${p.body.split("\n").join("\n> ")}\n\n`,
                p.id,
              )
            }
            onDeleted={(postId) =>
              setPosts((prev) => prev.filter((p) => p.id !== postId))
            }
          />
        ))}
      </div>

      {thread ? (
        <ShareBar
          url={threadShareURL(slug)}
          title={thread.title}
          className="border border-[var(--line)] bg-[var(--bg-elevated)] px-4 py-3"
        />
      ) : null}

      {pages > 1 ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {page > 1 ? (
            <button
              type="button"
              onClick={() => void load(page - 1)}
              className="border border-[var(--line)] px-3 py-1.5 text-sm font-semibold hover:border-[var(--accent)]"
            >
              Previous
            </button>
          ) : null}
          <span className="text-sm text-[var(--muted)]">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <button
              type="button"
              onClick={() => void load(page + 1)}
              className="border border-[var(--line)] px-3 py-1.5 text-sm font-semibold hover:border-[var(--accent)]"
            >
              Next
            </button>
          ) : null}
        </div>
      ) : null}

      {user && thread?.isLocked && !staff ? (
        <p className="flex items-center gap-2 border border-[var(--line)] bg-[var(--bg-elevated)] p-4 text-sm text-[var(--muted)]">
          <Lock className="h-4 w-4 shrink-0" />
          This thread is locked. No new replies can be posted.
        </p>
      ) : null}

      {user && (!thread?.isLocked || staff) ? (
        <form
          ref={replyRef}
          onSubmit={(e) => void submitReply(e)}
          className="space-y-3 border border-[var(--line)] bg-[var(--bg-elevated)] p-5 safe-bottom"
        >
          <h2 className="text-sm font-semibold">Reply</h2>
          {quotedPostId ? (
            <p className="text-xs text-[var(--muted)]">
              Quoting a post.{" "}
              <button
                type="button"
                className="text-[var(--accent)] hover:underline"
                onClick={() => setQuotedPostId(null)}
              >
                Clear quote
              </button>
            </p>
          ) : null}
          <MentionInput
            value={reply}
            onChange={setReply}
            placeholder="Share your take… (@ to mention)"
            rows={5}
            multiline
            required
            excludeUsername={user.username}
          />
          <ImageAttach
            attachments={attachments}
            onChange={setAttachments}
            disabled={busy}
          />
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Posting…" : "Post reply"}
          </button>
        </form>
      ) : !user ? (
        <p className="text-sm text-[var(--muted)]">
          <Link href="/login" className="font-semibold text-[var(--accent)] hover:underline">
            Log in
          </Link>{" "}
          to reply.
        </p>
      ) : null}

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        url={threadShareURL(slug)}
        title={thread?.title ?? "Thread"}
        label="Share this thread"
      />
    </div>
  );
}
