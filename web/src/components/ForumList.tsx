"use client";

import Link from "next/link";
import type { Category, Forum } from "@/lib/types";
import { formatCount, relativeTime } from "@/lib/format";
import { Avatar } from "./Avatar";

export function ForumList({ categories }: { categories: Category[] }) {
  if (!categories.length) {
    return (
      <p className="text-[var(--muted)]">No forums yet. Check back soon.</p>
    );
  }

  return (
    <div className="space-y-12">
      {categories.map((cat, i) => (
        <section
          key={cat.id}
          className="stagger-item"
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <div className="cat-label">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-[var(--fg)]">
                {cat.name}
              </h3>
              {cat.description ? (
                <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
                  {cat.description}
                </p>
              ) : null}
            </div>
          </div>

          <div className="forum-board">
            <div className="hidden border-b border-[var(--line)] py-2 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] md:grid md:grid-cols-[minmax(0,1fr)_minmax(10rem,0.8fr)] md:gap-4 lg:grid-cols-[minmax(0,1.4fr)_7.5rem_minmax(12rem,0.9fr)] lg:gap-5">
              <span>Forum</span>
              <span className="hidden text-right lg:block">Activity</span>
              <span>Latest</span>
            </div>
            {cat.forums.map((forum) => (
              <ForumRow key={forum.id} forum={forum} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ForumRow({ forum }: { forum: Forum }) {
  return (
    <Link href={`/forums/${forum.slug}`} className="forum-row group">
      <div className="min-w-0">
        <p className="forum-name text-[0.9875rem] font-medium text-[var(--fg)] transition-colors">
          {forum.name}
        </p>
        {forum.description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--muted)]">
            {forum.description}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-[var(--muted)] lg:hidden">
          {formatCount(forum.threadCount)} threads · {formatCount(forum.postCount)} posts
        </p>
      </div>

      <div className="hidden text-right text-sm lg:block">
        <p className="font-medium tabular-nums text-[var(--fg)]">
          {formatCount(forum.threadCount)}
        </p>
        <p className="text-xs text-[var(--muted)]">
          {formatCount(forum.postCount)} posts
        </p>
      </div>

      <div className="min-w-0">
        {forum.lastThreadTitle ? (
          <div className="flex items-start gap-2.5">
            <Avatar user={forum.lastPoster} size="sm" link={false} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--fg)]">
                {forum.lastThreadTitle}
              </p>
              <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                {forum.lastPoster?.displayName ?? "—"}
                <span className="mx-1.5 text-[var(--line-strong)]">·</span>
                {relativeTime(forum.lastPostAt)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">Quiet so far</p>
        )}
      </div>
    </Link>
  );
}
