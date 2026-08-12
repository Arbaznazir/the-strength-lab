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
};

export function TrustedStoresBoard() {
  const [stores, setStores] = useState<TrustedStore[]>([]);

  useEffect(() => {
    void apiFetch<{ stores: TrustedStore[] }>("/trusted-stores", { auth: false })
      .then((d) => setStores(d.stores ?? []))
      .catch(() => setStores([]));
  }, []);

  if (!stores.length) return null;

  return (
    <section className="min-w-0 overflow-hidden">
      <div className="cat-label min-w-0">
        <span className="cat-bar" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight break-words sm:text-lg">
            Trusted stores &amp; GH sources
          </h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Lab-vetted partners — curated by staff.
          </p>
        </div>
      </div>

      <div className="forum-board mt-3 min-w-0 divide-y divide-[var(--line)] overflow-hidden border border-[var(--line)] bg-[var(--bg-elevated)]">
        {stores.map((s) => {
          const href =
            s.linkUrl ||
            (s.forumSlug ? `/forums/${s.forumSlug}` : "#");
          const external = Boolean(s.linkUrl?.startsWith("http"));
          const banner = mediaURL(s.bannerUrl) || s.bannerUrl;
          return (
            <article key={s.id} className="min-w-0 overflow-hidden px-3 py-4 sm:px-5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {external ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 break-words text-base font-semibold text-[var(--accent)] hover:underline"
                  >
                    {s.name}
                  </a>
                ) : (
                  <Link
                    href={href}
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
                external ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative mt-3 block aspect-[5/1] w-full max-w-full overflow-hidden border border-[var(--line)] bg-[#0a0c0b]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={banner}
                      alt=""
                      className="h-full w-full max-w-full object-cover"
                    />
                  </a>
                ) : (
                  <div className="relative mt-3 aspect-[5/1] w-full max-w-full overflow-hidden border border-[var(--line)] bg-[#0a0c0b]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={banner}
                      alt=""
                      className="h-full w-full max-w-full object-cover"
                    />
                  </div>
                )
              ) : null}
              <p className="mt-3 text-xs text-[var(--muted)]">
                Topics: {formatCount(s.threadCount)} · Posts:{" "}
                {formatCount(s.postCount)}
              </p>
              {s.lastPostTitle ? (
                <p className="mt-1 truncate text-sm text-[var(--muted)]">
                  Last post:{" "}
                  <span className="text-[var(--fg)]">{s.lastPostTitle}</span>
                  {s.lastPostAt ? ` · ${relativeTime(s.lastPostAt)}` : ""}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** Compact sidebar block under Trending */
export function TrustedStoresSideBlock() {
  const [stores, setStores] = useState<TrustedStore[]>([]);

  useEffect(() => {
    void apiFetch<{ stores: TrustedStore[] }>("/trusted-stores", { auth: false })
      .then((d) => setStores((d.stores ?? []).slice(0, 5)))
      .catch(() => setStores([]));
  }, []);

  if (!stores.length) return null;

  return (
    <section className="side-panel">
      <h3 className="kicker mb-4">Trusted stores &amp; GH sources</h3>
      <ul className="space-y-4">
        {stores.map((s) => {
          const href =
            s.linkUrl || (s.forumSlug ? `/forums/${s.forumSlug}` : "#");
          const external = Boolean(s.linkUrl?.startsWith("http"));
          return (
            <li key={s.id}>
              {external ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <StoreSideMeta s={s} />
                </a>
              ) : (
                <Link href={href} className="group block">
                  <StoreSideMeta s={s} />
                </Link>
              )}
            </li>
          );
        })}
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

