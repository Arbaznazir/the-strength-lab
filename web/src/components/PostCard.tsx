"use client";

import { useState } from "react";
import { Heart, Flag, MessageSquare, Quote, Share2 } from "lucide-react";
import clsx from "clsx";
import Link from "next/link";
import type { Post } from "@/lib/types";
import { relativeTime } from "@/lib/format";
import { apiFetch, mediaURL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { postShareURL } from "@/lib/site";
import { renderTextWithMentions } from "@/lib/mentions";
import { Avatar } from "./Avatar";
import { ShareModal } from "./ShareModal";

export function PostCard({
  post,
  index = 0,
  threadSlug,
  threadTitle = "",
  canReply = false,
  onReply,
  onQuote,
  onReacted,
}: {
  post: Post;
  index?: number;
  threadSlug: string;
  threadTitle?: string;
  canReply?: boolean;
  onReply?: (post: Post) => void;
  onQuote?: (post: Post) => void;
  onReacted?: (postId: string, reacted: boolean) => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [reacted, setReacted] = useState(post.reactedByMe);
  const [count, setCount] = useState(post.reactionCount);
  const [reportOpen, setReportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  async function react() {
    if (!user || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch<{ reacted: boolean }>(
        `/posts/${post.id}/reactions`,
        { method: "POST", body: {} },
      );
      const nowReacted = res.reacted ?? !reacted;
      setReacted(nowReacted);
      setCount((c) => (nowReacted ? c + 1 : Math.max(0, c - 1)));
      onReacted?.(post.id, nowReacted);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not react");
    } finally {
      setBusy(false);
    }
  }

  async function report() {
    if (!user || !reason.trim()) return;
    setBusy(true);
    try {
      await apiFetch("/reports", {
        method: "POST",
        body: {
          targetType: "post",
          targetId: post.id,
          reason: reason.trim(),
        },
      });
      setReportOpen(false);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report failed");
    } finally {
      setBusy(false);
    }
  }

  const isStaff = post.author.role === "admin" || post.author.role === "moderator";
  const attachments = post.attachments ?? [];
  const shareUrl = postShareURL(threadSlug, post.id);
  const shareText = threadTitle || `Post by ${post.author.displayName}`;

  return (
    <article id={`post-${post.id}`} className="post-shell scroll-mt-24">
      <aside className="post-meta">
        <div className="flex items-center gap-3 md:flex-col md:items-start md:gap-3">
          <Avatar user={post.author} size="lg" />
          <div className="min-w-0 md:w-full">
            <Link
              href={`/members/${post.author.username}`}
              className="block truncate text-sm font-semibold hover:text-[var(--accent)]"
            >
              {post.author.displayName}
            </Link>
            <p className={clsx("mt-0.5 text-[11px]", isStaff ? "text-[var(--staff)]" : "text-[var(--muted)]")}>
              {post.author.title || post.author.role}
            </p>
            <p className="mt-2 hidden text-[11px] text-[var(--muted)] md:block">
              {post.author.messageCount} posts · {post.author.trophyPoints} pts
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
          <span>{relativeTime(post.createdAt)}</span>
          <span>#{index + 1}</span>
        </div>

        {post.quotedPost ? (
          <blockquote className="mb-4 border-l-2 border-[var(--accent)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--muted)]">
            <Link
              href={`#post-${post.quotedPost.id}`}
              className="mb-1 block text-xs font-semibold text-[var(--accent)] hover:underline"
            >
              {post.quotedPost.author.displayName} wrote:
            </Link>
            <p className="line-clamp-4 whitespace-pre-wrap">
              {renderTextWithMentions(post.quotedPost.body)}
            </p>
          </blockquote>
        ) : null}

        <div className="flex-1 whitespace-pre-wrap text-[15px] leading-[1.7] text-[var(--fg)]">
          {renderTextWithMentions(post.body)}
        </div>

        {attachments.length ? (
          <div className="mt-5 border-t border-[var(--line)] pt-4">
            <p className="kicker mb-3">Attachments</p>
            <ul className="flex flex-wrap gap-3">
              {attachments.map((a) => (
                <li key={a.id} className="w-40 border border-[var(--line)] bg-[var(--bg)]">
                  <button
                    type="button"
                    className="block w-full text-left"
                    onClick={() => setLightbox(mediaURL(a.url))}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mediaURL(a.url)}
                      alt={a.filename}
                      className="h-28 w-full object-cover"
                    />
                    <span className="block truncate px-2 py-1.5 text-[11px] text-[var(--muted)]">
                      {a.filename}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
          <button
            type="button"
            onClick={() => void react()}
            disabled={!user || busy}
            className={clsx(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold transition-colors",
              reacted
                ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                : "border border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--fg)]",
              (!user || busy) && "opacity-60",
            )}
          >
            <Heart className={clsx("h-3.5 w-3.5", reacted && "fill-current")} />
            {count}
          </button>
          {canReply && onReply ? (
            <button
              type="button"
              onClick={() => onReply(post)}
              className="inline-flex items-center gap-1.5 border border-[var(--line)] px-2.5 py-1.5 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--fg)]"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Reply
            </button>
          ) : null}
          {canReply && onQuote ? (
            <button
              type="button"
              onClick={() => onQuote(post)}
              className="inline-flex items-center gap-1.5 border border-[var(--line)] px-2.5 py-1.5 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--fg)]"
            >
              <Quote className="h-3.5 w-3.5" />
              Quote
            </button>
          ) : null}
          {user ? (
            <button
              type="button"
              onClick={() => setReportOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 border border-[var(--line)] px-2.5 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--fg)]"
            >
              <Flag className="h-3.5 w-3.5" />
              Report
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="inline-flex items-center gap-1.5 border border-[var(--line)] px-2.5 py-1.5 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--fg)]"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
          {error ? <span className="text-xs text-[var(--danger)]">{error}</span> : null}
        </div>

        {reportOpen ? (
          <div className="mt-3 space-y-2 border border-[var(--line)] bg-[var(--bg)] p-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Why are you reporting this?"
              className="field w-full"
            />
            <button
              type="button"
              onClick={() => void report()}
              disabled={busy || !reason.trim()}
              className="btn-primary text-xs"
            >
              Submit report
            </button>
          </div>
        ) : null}
      </div>

      {lightbox ? (
        <button
          type="button"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
          aria-label="Close image"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-h-[90vh] max-w-[min(960px,95vw)] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </button>
      ) : null}

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        url={shareUrl}
        title={shareText}
        label="Share this post"
      />
    </article>
  );
}
