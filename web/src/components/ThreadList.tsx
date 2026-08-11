"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Lock, Pin } from "lucide-react";
import clsx from "clsx";
import type { Thread } from "@/lib/types";
import { absoluteDate, formatCount } from "@/lib/format";
import { Avatar } from "./Avatar";

export type ThreadSort =
  | "last_activity"
  | "started"
  | "title"
  | "replies"
  | "views";

export type ThreadFilter = "" | "open" | "locked" | "featured" | "pinned";

const SORT_OPTIONS: { value: ThreadSort; label: string }[] = [
  { value: "last_activity", label: "Last activity" },
  { value: "started", label: "Start date" },
  { value: "title", label: "Title" },
  { value: "replies", label: "Most replies" },
  { value: "views", label: "Most views" },
];

const FILTER_OPTIONS: { value: ThreadFilter; label: string }[] = [
  { value: "", label: "All threads" },
  { value: "open", label: "Open only" },
  { value: "locked", label: "Locked" },
  { value: "featured", label: "Featured" },
  { value: "pinned", label: "Pinned" },
];

export function ThreadFilters({
  sort,
  filter,
  onChange,
}: {
  sort: ThreadSort;
  filter: ThreadFilter;
  onChange: (next: { sort: ThreadSort; filter: ThreadFilter }) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const activeLabel =
    FILTER_OPTIONS.find((o) => o.value === filter)?.label !== "All threads"
      ? FILTER_OPTIONS.find((o) => o.value === filter)?.label
      : SORT_OPTIONS.find((o) => o.value === sort)?.label;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2 text-sm font-medium text-[var(--fg)] hover:border-[var(--accent)]"
        aria-expanded={open}
      >
        Filters
        <span className="hidden text-[var(--muted)] sm:inline">· {activeLabel}</span>
        <ChevronDown className={clsx("h-4 w-4 text-[var(--muted)] transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-56 border border-[var(--line)] bg-[var(--bg-elevated)] py-2 shadow-2xl">
          <p className="kicker px-3 pb-2 pt-1">Sort by</p>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={clsx(
                "block w-full px-3 py-2 text-left text-sm hover:bg-[var(--accent-dim)]",
                sort === opt.value && "text-[var(--accent)]",
              )}
              onClick={() => {
                onChange({ sort: opt.value, filter });
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
          <div className="my-2 border-t border-[var(--line)]" />
          <p className="kicker px-3 pb-2 pt-1">Show</p>
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value || "all"}
              type="button"
              className={clsx(
                "block w-full px-3 py-2 text-left text-sm hover:bg-[var(--accent-dim)]",
                filter === opt.value && "text-[var(--accent)]",
              )}
              onClick={() => {
                onChange({ sort, filter: opt.value });
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ThreadList({
  threads,
  empty = "No threads yet. Be the first to post.",
  page = 1,
  pages = 1,
  onPageChange,
}: {
  threads: Thread[];
  empty?: string;
  page?: number;
  pages?: number;
  onPageChange?: (page: number) => void;
}) {
  if (!threads.length) {
    return <p className="py-8 text-[var(--muted)]">{empty}</p>;
  }

  return (
    <div>
      <div className="hidden border-b border-[var(--line-strong)] pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] md:grid md:grid-cols-[minmax(0,1fr)_4rem_4rem] md:gap-3 lg:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_11rem] lg:gap-4">
        <span>Title</span>
        <span className="text-right">Replies</span>
        <span className="text-right">Views</span>
        <span className="hidden text-right lg:block">Last post</span>
      </div>

      <ul className="divide-y divide-[var(--line)] border-b border-[var(--line)]">
        {threads.map((thread, i) => (
          <ThreadRow
            key={thread.id}
            thread={thread}
            style={{ animationDelay: `${i * 30}ms` }}
          />
        ))}
      </ul>

      {pages > 1 && onPageChange ? (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {Array.from({ length: pages }, (_, idx) => idx + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPageChange(n)}
              className={clsx(
                "min-w-9 border px-3 py-1.5 text-sm font-semibold",
                n === page
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]"
                  : "border-[var(--line)] text-[var(--fg)] hover:border-[var(--accent)]",
              )}
            >
              {n}
            </button>
          ))}
          {page < pages ? (
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              className="border border-[var(--line)] px-3 py-1.5 text-sm font-semibold hover:border-[var(--accent)]"
            >
              Next
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ThreadRow({
  thread,
  style,
}: {
  thread: Thread;
  style?: React.CSSProperties;
}) {
  const [hover, setHover] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const tipId = useId();
  const last = thread.lastPoster ?? thread.author;
  const pagesHint = Math.max(1, Math.ceil((thread.replyCount + 1) / 20));

  function handleTitleClick(e: React.MouseEvent) {
    if (!thread.preview) return;
    if (window.matchMedia("(hover: none)").matches) {
      if (!previewOpen) {
        e.preventDefault();
        setPreviewOpen(true);
      }
    }
  }

  return (
    <li className="stagger-item relative py-4" style={style}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 md:grid-cols-[auto_minmax(0,1fr)_4rem_4rem] md:items-center md:gap-3 lg:grid-cols-[auto_minmax(0,1fr)_5.5rem_5.5rem_11rem] lg:gap-4">
        <Avatar user={thread.author} size="lg" />

        <div className="min-w-0">
          <div className="relative flex flex-wrap items-center gap-2">
            {thread.isPinned ? <Pin className="h-3.5 w-3.5 text-[var(--accent)]" /> : null}
            {thread.isLocked ? <Lock className="h-3.5 w-3.5 text-[var(--muted)]" /> : null}

            <Link
              href={`/threads/${thread.slug}`}
              className="thread-title text-[0.9375rem] font-medium leading-snug text-[var(--fg)] transition-colors hover:text-[var(--accent)]"
              onMouseEnter={() => setHover(true)}
              onMouseLeave={() => setHover(false)}
              onFocus={() => setHover(true)}
              onBlur={() => setHover(false)}
              onClick={handleTitleClick}
              aria-describedby={thread.preview ? tipId : undefined}
            >
              {thread.title}
            </Link>

            {thread.isFeatured ? (
              <span className="border border-[var(--accent)]/40 bg-[var(--accent-dim)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                Featured
              </span>
            ) : null}

            {pagesHint > 1 ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)]">
                {Array.from({ length: Math.min(pagesHint, 3) }, (_, i) => (
                  <Link
                    key={i}
                    href={`/threads/${thread.slug}?page=${i + 1}`}
                    className="border border-[var(--line)] px-1.5 py-0.5 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    {i + 1}
                  </Link>
                ))}
                {pagesHint > 3 ? (
                  <Link
                    href={`/threads/${thread.slug}?page=${pagesHint}`}
                    className="border border-[var(--line)] px-1.5 py-0.5 hover:border-[var(--accent)]"
                  >
                    Last
                  </Link>
                ) : null}
              </span>
            ) : null}

            {hover && thread.preview ? (
              <div
                id={tipId}
                role="tooltip"
                className="pointer-events-none absolute left-0 top-[calc(100%+0.4rem)] z-20 hidden w-[min(22rem,calc(100vw-2rem))] border border-[var(--line-strong)] bg-[var(--bg-elevated)] p-3 shadow-2xl anim-fade md:block"
              >
                <p className="kicker mb-2">Post highlight</p>
                <p className="line-clamp-4 text-sm leading-relaxed text-[var(--fg)]/90">
                  {thread.preview}
                </p>
              </div>
            ) : null}
          </div>

          {previewOpen && thread.preview ? (
            <div className="mt-2 border border-[var(--line)] bg-[var(--bg-elevated)] p-3 md:hidden">
              <p className="kicker mb-1.5">Post highlight</p>
              <p className="line-clamp-4 text-sm leading-relaxed text-[var(--fg)]/90">
                {thread.preview}
              </p>
              <Link
                href={`/threads/${thread.slug}`}
                className="mt-2 inline-block text-xs font-semibold text-[var(--accent)]"
              >
                Open thread →
              </Link>
            </div>
          ) : null}

          <p className="mt-1.5 text-sm text-[var(--muted)]">
            <Link
              href={`/members/${thread.author.username}`}
              className="hover:text-[var(--accent)] hover:underline"
            >
              {thread.author.displayName}
            </Link>
            <span className="mx-1.5 opacity-40">·</span>
            <Link
              href={`/threads/${thread.slug}`}
              className="hover:text-[var(--accent)] hover:underline"
              title={absoluteDate(thread.createdAt)}
            >
              {absoluteDate(thread.createdAt)}
            </Link>
          </p>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)] md:hidden">
            <span>
              Replies: <strong className="text-[var(--fg)]">{formatCount(thread.replyCount)}</strong>
            </span>
            <span>
              Views: <strong className="text-[var(--fg)]">{formatCount(thread.viewCount)}</strong>
            </span>
            <span className="lg:hidden">
              Last:{" "}
              <Link href={`/threads/${thread.slug}`} className="hover:text-[var(--accent)]">
                {absoluteDate(thread.lastPostAt)}
              </Link>
            </span>
          </div>
        </div>

        <div className="hidden text-right text-sm md:block">
          <p className="text-[11px] uppercase tracking-wide text-[var(--muted)] lg:hidden">Rep</p>
          <p className="hidden text-[11px] uppercase tracking-wide text-[var(--muted)] lg:block">Replies</p>
          <p className="font-medium tabular-nums text-[var(--fg)]">
            {formatCount(thread.replyCount)}
          </p>
        </div>

        <div className="hidden text-right text-sm md:block">
          <p className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Views</p>
          <p className="font-medium tabular-nums text-[var(--fg)]">
            {formatCount(thread.viewCount)}
          </p>
        </div>

        <div className="hidden items-center justify-end gap-2 lg:flex">
          <div className="min-w-0 text-right">
            <Link
              href={`/threads/${thread.slug}`}
              className="block text-sm text-[var(--fg)] hover:text-[var(--accent)] hover:underline"
              title="Jump to latest"
            >
              {absoluteDate(thread.lastPostAt)}
            </Link>
            <Link
              href={`/members/${last.username}`}
              className="mt-0.5 block truncate text-xs text-[var(--muted)] hover:text-[var(--accent)] hover:underline"
            >
              {last.displayName}
            </Link>
          </div>
          <Avatar user={last} size="sm" link={false} />
        </div>
      </div>
    </li>
  );
}
