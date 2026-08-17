"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, mediaURL } from "@/lib/api";
import { formatCount, relativeTime } from "@/lib/format";
import { TagBadge } from "@/components/TagBadge";

export type TrustedStore = {
  id: string;
  name: string;
  slug: string;
  tagLabel: string;
  tagColor: string;
  bannerUrl: string;
  linkUrl: string;
  description: string;
  forumSlug?: string;
  threadCount: number;
  postCount: number;
  lastPostTitle?: string;
  lastPostAt?: string;
  threadSlug?: string;
};

function isVideoBanner(url: string) {
  const lower = url.toLowerCase().split("?")[0] ?? "";
  return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov");
}

export function useTrustedStores() {
  const [stores, setStores] = useState<TrustedStore[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void apiFetch<{ stores: TrustedStore[] }>("/trusted-stores", { auth: false })
      .then((d) => setStores(d.stores ?? []))
      .catch(() => setStores([]))
      .finally(() => setLoaded(true));
  }, []);

  return { stores, loaded };
}

export function TrustedStoresBoard({
  limit,
  showHeading = true,
}: {
  limit?: number;
  showHeading?: boolean;
}) {
  const { stores, loaded } = useTrustedStores();
  const list = typeof limit === "number" ? stores.slice(0, limit) : stores;

  useEffect(() => {
    if (!loaded) return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    document
      .getElementById(hash)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loaded, stores]);

  if (loaded && !stores.length) {
    return showHeading ? null : (
      <p className="text-sm text-[var(--muted)]">No sponsors listed yet.</p>
    );
  }
  if (!list.length) return null;

  return (
    <section className="min-w-0 overflow-hidden">
      {showHeading ? (
        <div className="cat-label min-w-0">
          <span className="cat-bar" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight break-words sm:text-lg">
              <Link href="/sponsors" className="hover:text-[var(--accent)]">
                Sponsors
              </Link>
            </h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              Lab-vetted partners — curated by staff.{" "}
              <Link
                href="/sponsors"
                className="text-[var(--fg)] hover:text-[var(--accent)]"
              >
                View all →
              </Link>
            </p>
          </div>
        </div>
      ) : null}

      <div className="forum-board mt-3 min-w-0 divide-y divide-[var(--line)] overflow-hidden border border-[var(--line)] bg-[var(--bg-elevated)]">
        {list.map((s) => (
          <SponsorStoreCard key={s.id} store={s} />
        ))}
      </div>
    </section>
  );
}

export function SponsorStoreCard({ store: s }: { store: TrustedStore }) {
  const shopHref = s.linkUrl?.startsWith("http") ? s.linkUrl : "";
  const threadHref = s.threadSlug
    ? `/threads/${s.threadSlug}`
    : s.forumSlug
      ? `/forums/${s.forumSlug}`
      : "";
  const nameHref = shopHref || threadHref || "/sponsors";
  const nameExternal = Boolean(shopHref);
  const banner = mediaURL(s.bannerUrl) || s.bannerUrl;

  return (
    <article
      id={s.slug}
      className="min-w-0 scroll-mt-24 overflow-hidden px-3 py-4 sm:px-5"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {nameExternal ? (
          <a
            href={nameHref}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="min-w-0 break-words text-base font-semibold text-[var(--accent)] hover:underline"
          >
            {s.name}
          </a>
        ) : (
          <Link
            href={nameHref}
            className="min-w-0 break-words text-base font-semibold text-[var(--accent)] hover:underline"
          >
            {s.name}
          </Link>
        )}
        <TagBadge
          tag={{
            slug: "trusted-store",
            label: s.tagLabel || "Trusted Source",
            color: s.tagColor || "#d4ff3a",
          }}
        />
      </div>
      {s.description ? (
        <p className="mt-1 break-words text-sm text-[var(--muted)]">
          {s.description}
        </p>
      ) : null}
      {banner ? (
        <StoreBanner
          src={banner}
          name={s.name}
          href={shopHref || threadHref || undefined}
          external={Boolean(shopHref)}
        />
      ) : null}
      <p className="mt-3 text-xs text-[var(--muted)]">
        Topics: {formatCount(s.threadCount)} · Posts:{" "}
        {formatCount(s.postCount)}
      </p>
      {s.lastPostTitle ? (
        <p className="mt-1 truncate text-sm text-[var(--muted)]">
          Official post:{" "}
          {s.threadSlug ? (
            <Link
              href={`/threads/${s.threadSlug}`}
              className="text-[var(--fg)] hover:text-[var(--accent)]"
            >
              {s.lastPostTitle}
            </Link>
          ) : (
            <span className="text-[var(--fg)]">{s.lastPostTitle}</span>
          )}
          {s.lastPostAt ? ` · ${relativeTime(s.lastPostAt)}` : ""}
        </p>
      ) : null}
    </article>
  );
}

function StoreBanner({
  src,
  name,
  href,
  external,
}: {
  src: string;
  name: string;
  href?: string;
  external?: boolean;
}) {
  const media = isVideoBanner(src) ? (
    <video
      src={src}
      className="pointer-events-none h-full w-full object-cover"
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
      alt=""
      className="pointer-events-none h-full w-full max-w-full object-cover"
    />
  );

  const className =
    "relative mt-3 block aspect-[5/1] w-full max-w-full overflow-hidden border border-[var(--line)] bg-[#0a0c0b]";

  if (!href) {
    return <div className={className}>{media}</div>;
  }
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer sponsored"
        aria-label={`Visit ${name}`}
        className={className}
      >
        {media}
      </a>
    );
  }
  return (
    <Link href={href} aria-label={name} className={className}>
      {media}
    </Link>
  );
}

/** Compact sidebar block under Trending */
export function TrustedStoresSideBlock() {
  const { stores } = useTrustedStores();

  if (!stores.length) return null;

  return (
    <section className="side-panel">
      <h3 className="kicker mb-4">
        <Link href="/sponsors" className="hover:text-[var(--accent)]">
          Sponsors
        </Link>
      </h3>
      <ul className="space-y-4">
        {stores.map((s) => (
          <li key={s.id}>
            <Link href={`/sponsors#${s.slug}`} className="group block">
              <StoreSideMeta s={s} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StoreSideMeta({ s }: { s: TrustedStore }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-[var(--fg)] group-hover:text-[var(--accent)]">
        {s.name}
      </p>
      <div className="mt-1">
        <TagBadge
          tag={{
            slug: "ts",
            label: s.tagLabel || "Trusted",
            color: s.tagColor || "#d4ff3a",
          }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-[var(--muted)]">
        {s.threadCount} topics · {s.postCount} posts
      </p>
    </div>
  );
}
