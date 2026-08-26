"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, mediaURL } from "@/lib/api";
import { formatCount, relativeTime } from "@/lib/format";
import { isSquareSponsorBanner, sponsorHubPath } from "@/lib/sponsors";
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

export function externalStoreHref(linkUrl?: string) {
  const url = linkUrl?.trim();
  return url?.startsWith("http") ? url : undefined;
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
              Lab-vetted partners — open a sponsor for their threads and banner.{" "}
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
  const hubHref = sponsorHubPath(s.slug);
  const banner = mediaURL(s.bannerUrl) || s.bannerUrl;

  return (
    <article
      id={s.slug}
      className="min-w-0 scroll-mt-24 overflow-hidden px-3 py-4 sm:px-5"
    >
      <Link href={hubHref} className="group block min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 break-words text-base font-semibold text-[var(--accent)] group-hover:underline">
            {s.name}
          </span>
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
          <StoreBanner src={banner} name={s.name} className="mt-3" />
        ) : null}
      </Link>
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

export function SponsorStoreBanner({
  store,
  className = "",
  linkToStore = false,
}: {
  store: TrustedStore;
  className?: string;
  /** When true (sponsor hub), banner opens the external store URL. */
  linkToStore?: boolean;
}) {
  const banner = mediaURL(store.bannerUrl) || store.bannerUrl;
  if (!banner) return null;

  const media = (
    <StoreBanner
      src={banner}
      name={store.name}
      className={
        className ||
        (isSquareSponsorBanner(store.bannerUrl, store.name) ? "" : "w-full")
      }
    />
  );

  const href = linkToStore ? externalStoreHref(store.linkUrl) : undefined;
  if (!href) return media;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="block"
      aria-label={`Visit ${store.name} store`}
    >
      {media}
    </a>
  );
}

function StoreBanner({
  src,
  name,
  className = "",
}: {
  src: string;
  name: string;
  className?: string;
}) {
  const square = isSquareSponsorBanner(src, name);
  const media = isVideoBanner(src) ? (
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
      alt={name}
      className="pointer-events-none h-full w-full max-w-full object-contain"
    />
  );

  return (
    <div
      className={
        square
          ? `relative block aspect-square w-full max-w-[16rem] overflow-hidden border border-[var(--line)] bg-[#0a0c0b] sm:max-w-[18rem] ${className}`
          : `relative block aspect-[5/1] max-w-full overflow-hidden border border-[var(--line)] bg-[#0a0c0b] ${className}`
      }
    >
      {media}
    </div>
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
            <Link href={sponsorHubPath(s.slug)} className="group block">
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
