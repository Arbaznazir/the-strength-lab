"use client";

import Link from "next/link";
import type { Category, Forum } from "@/lib/types";
import { formatCount, relativeTime } from "@/lib/format";
import { mediaURL } from "@/lib/api";
import { Avatar } from "./Avatar";

export type SponsorBanner = {
  id: string;
  name: string;
  imageUrl: string;
  linkUrl: string;
  forumId?: string | null;
  threadSlug?: string;
  threadTitle?: string;
  sortOrder: number;
  isActive?: boolean;
};

/** Assign banners to forums: explicit forum_id first, then place each leftover banner once. */
export function mapSponsorsToForums(
  forums: Forum[],
  banners: SponsorBanner[],
): Record<string, SponsorBanner> {
  const active = banners.filter((b) => b.isActive !== false && b.imageUrl);
  const assigned: Record<string, SponsorBanner> = {};
  const used = new Set<string>();

  for (const b of active) {
    if (b.forumId && forums.some((f) => f.id === b.forumId) && !assigned[b.forumId]) {
      assigned[b.forumId] = b;
      used.add(b.id);
    }
  }

  const pool = active.filter((b) => !used.has(b.id));
  if (!pool.length) return assigned;

  // Spread leftover banners across free forums (each banner appears at most once)
  const free = forums.filter((f) => !assigned[f.id]);
  if (!free.length) return assigned;

  const step = Math.max(1, Math.floor(free.length / pool.length));
  for (let i = 0; i < pool.length; i++) {
    const idx = Math.min(i * step, free.length - 1);
    // Find next free slot if collision from Math.min at end
    let target = free[idx];
    let probe = idx;
    while (target && assigned[target.id] && probe < free.length - 1) {
      probe++;
      target = free[probe];
    }
    if (target && !assigned[target.id]) {
      assigned[target.id] = pool[i];
    }
  }
  return assigned;
}

export function ForumList({
  categories,
  sponsorsByForumId,
}: {
  categories: Category[];
  sponsorsByForumId?: Record<string, SponsorBanner>;
}) {
  if (!categories.length) {
    return (
      <p className="text-[var(--muted)]">No forums yet. Check back soon.</p>
    );
  }

  return (
    <div className="min-w-0 space-y-12">
      {categories.map((cat, i) => (
        <section
          key={cat.id}
          className="stagger-item min-w-0"
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <div className="cat-label">
            <div className="min-w-0">
              <h3 className="break-words text-lg font-semibold tracking-tight text-[var(--fg)]">
                {cat.name}
              </h3>
              {cat.description ? (
                <p className="mt-1 max-w-2xl break-words text-sm text-[var(--muted)]">
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
              <ForumRow
                key={forum.id}
                forum={forum}
                sponsor={sponsorsByForumId?.[forum.id]}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function isVideoBanner(url: string) {
  const lower = url.toLowerCase().split("?")[0] ?? "";
  return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov");
}

export function SponsorBannerMedia({ banner }: { banner: SponsorBanner }) {
  const src = mediaURL(banner.imageUrl) || banner.imageUrl;
  const href = banner.linkUrl?.trim() || undefined;
  const media = isVideoBanner(banner.imageUrl) ? (
    <video
      src={src}
      className="pointer-events-none h-full w-full object-contain"
      autoPlay
      muted
      loop
      playsInline
      tabIndex={-1}
      aria-hidden
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={banner.name}
      className="pointer-events-none h-full w-full object-contain"
    />
  );

  const shellClass =
    "mt-3 block w-full cursor-pointer overflow-hidden border border-[var(--line)] bg-[var(--bg)] aspect-[6/1] max-h-28 sm:max-h-32";

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={shellClass}
        aria-label={`Visit ${banner.name}`}
      >
        {media}
      </a>
    );
  }
  return <div className={shellClass}>{media}</div>;
}

function ForumRow({
  forum,
  sponsor,
}: {
  forum: Forum;
  sponsor?: SponsorBanner;
}) {
  return (
    <div className="forum-row-wrap group border-t border-[var(--line)] py-4 transition-colors hover:bg-[color-mix(in_oklab,var(--accent)_4%,transparent)]">
      <div className="forum-row !border-0 !py-0">
        <div className="min-w-0">
          <Link href={`/forums/${forum.slug}`} className="block min-w-0">
            <p className="forum-name text-[0.9875rem] font-medium text-[var(--fg)] transition-colors group-hover:text-[var(--accent)]">
              {forum.name}
            </p>
            {forum.description ? (
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--muted)]">
                {forum.description}
              </p>
            ) : null}
          </Link>
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
            <Link href={`/forums/${forum.slug}`} className="block min-w-0">
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
            </Link>
          ) : (
            <p className="text-sm text-[var(--muted)]">Quiet so far</p>
          )}
        </div>
      </div>

      {sponsor ? (
        <div className="w-full min-w-0">
          <SponsorBannerMedia banner={sponsor} />
          {sponsor.threadSlug ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Official post:{" "}
              <Link
                href={`/forums/${forum.slug}`}
                className="font-medium text-[var(--fg)] hover:text-[var(--accent)]"
                onClick={(e) => e.stopPropagation()}
              >
                {sponsor.threadTitle || sponsor.name}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
