"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { apiFetch, mediaURL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { sponsorHubPath, SPONSOR_CONTACTS, whatsappHref } from "@/lib/sponsors";
import type { Thread } from "@/lib/types";
import {
  ThreadFilters,
  ThreadList,
  type ThreadFilter,
  type ThreadSort,
} from "@/components/ThreadList";
import { Sidebar } from "@/components/Sidebar";
import { Pagination } from "@/components/Pagination";
import { TagBadge } from "@/components/TagBadge";
import {
  SponsorStoreBanner,
  externalStoreHref,
  type TrustedStore,
  useTrustedStores,
} from "@/components/TrustedStores";

type ForumThreads = {
  threads: Thread[];
  page: number;
  pages: number;
  total: number;
};

export default function SponsorHubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { user } = useAuth();
  const { stores, loaded: storesLoaded } = useTrustedStores();
  const store = stores.find((s) => s.slug === slug) ?? null;

  const [threads, setThreads] = useState<Thread[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<ThreadSort>("last_activity");
  const [filter, setFilter] = useState<ThreadFilter>("");
  const [error, setError] = useState("");

  const loadThreads = useCallback(async () => {
    if (!store?.forumSlug) {
      setThreads([]);
      setPages(1);
      setTotal(0);
      return;
    }
    try {
      const qs = new URLSearchParams({
        page: String(page),
        sort,
      });
      if (filter) qs.set("filter", filter);
      const data = await apiFetch<ForumThreads>(
        `/forums/${store.forumSlug}?${qs.toString()}`,
        { auth: false },
      );
      setThreads(data.threads ?? []);
      setPages(data.pages || 1);
      setTotal(data.total ?? data.threads?.length ?? 0);
      if (data.page && data.page !== page) setPage(data.page);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load threads");
    }
  }, [store?.forumSlug, page, sort, filter]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  if (storesLoaded && !store) {
    return (
      <div className="container-lab space-y-4 py-12">
        <p className="text-[var(--muted)]">Sponsor not found.</p>
        <Link href="/sponsors" className="text-sm font-medium text-[var(--accent)]">
          ← All sponsors
        </Link>
      </div>
    );
  }

  const storeHref = externalStoreHref(store?.linkUrl);
  const contacts = store ? SPONSOR_CONTACTS[store.slug] : undefined;

  return (
    <div className="container-lab space-y-8 py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-6">
        <div className="min-w-0">
          <p className="kicker">
            <Link href="/sponsors" className="hover:text-[var(--accent)]">
              Sponsors
            </Link>
            {store ? (
              <>
                <span className="mx-2 opacity-40">›</span>
                <span>{store.name}</span>
              </>
            ) : null}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {storeHref ? (
              <a
                href={storeHref}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="group inline-flex flex-wrap items-center gap-2"
              >
                <h1 className="text-2xl font-semibold tracking-tight transition-colors group-hover:text-[var(--accent)] sm:text-3xl">
                  {store?.name ?? "Sponsor"}
                </h1>
              </a>
            ) : (
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {store?.name ?? "Sponsor"}
              </h1>
            )}
            {store ? (
              <TagBadge
                tag={{
                  slug: "trusted-store",
                  label: store.tagLabel || "Trusted Source",
                  color: store.tagColor || "#d4ff3a",
                }}
              />
            ) : null}
          </div>
          {store?.description ? (
            <p className="mt-2 max-w-2xl text-[var(--muted)]">{store.description}</p>
          ) : null}
          {storeHref ? (
            <a
              href={storeHref}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="mt-3 inline-block text-sm font-medium text-[var(--muted)] hover:text-[var(--accent)]"
            >
              Visit store ↗
            </a>
          ) : null}
          {contacts ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="border border-[var(--line)] bg-[var(--bg)] p-4">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Visit us
                </p>
                <ul className="mt-2 space-y-1.5">
                  {contacts.visit.map((v) => (
                    <li key={v.href}>
                      <a
                        href={v.href}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        className="text-sm font-medium text-[var(--fg)] hover:text-[var(--accent)]"
                      >
                        {v.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border border-[var(--line)] bg-[var(--bg)] p-4">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Contact us
                </p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {contacts.email ? (
                    <li>
                      <span className="text-[var(--muted)]">Email: </span>
                      <a
                        href={`mailto:${contacts.email}`}
                        className="font-medium text-[var(--fg)] hover:text-[var(--accent)]"
                      >
                        {contacts.email}
                      </a>
                    </li>
                  ) : null}
                  {contacts.whatsapp ? (
                    <li>
                      <span className="text-[var(--muted)]">WhatsApp: </span>
                      <a
                        href={whatsappHref(contacts.whatsapp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[var(--fg)] hover:text-[var(--accent)]"
                      >
                        {contacts.whatsapp}
                      </a>
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
        {store?.forumSlug && user ? (
          <Link
            href={`/new-post?forum=${encodeURIComponent(store.forumSlug)}`}
            className="btn-primary"
          >
            Post thread
          </Link>
        ) : store?.forumSlug ? (
          <Link
            href={`/login?next=${encodeURIComponent(sponsorHubPath(slug))}`}
            className="btn-primary"
          >
            Post thread
          </Link>
        ) : null}
      </div>

      {store?.bannerUrl ? (
        <SponsorStoreBanner store={store} linkToStore />
      ) : null}

      {store?.threadSlug ? (
        <p className="text-sm text-[var(--muted)]">
          Official thread:{" "}
          <Link
            href={`/threads/${store.threadSlug}`}
            className="font-medium text-[var(--fg)] hover:text-[var(--accent)]"
          >
            {store.lastPostTitle || store.name}
          </Link>
        </p>
      ) : null}

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_13rem] md:gap-6 lg:grid-cols-[minmax(0,1fr)_16.5rem] lg:gap-12">
        <div className="min-w-0 space-y-4 overflow-x-hidden">
          {!store?.forumSlug ? (
            <p className="text-[var(--muted)]">
              {store?.threadSlug ? (
                <>
                  No forum linked yet.{" "}
                  <Link
                    href={`/threads/${store.threadSlug}`}
                    className="text-[var(--accent)] hover:underline"
                  >
                    Open official thread
                  </Link>
                </>
              ) : (
                "Threads coming soon."
              )}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-[var(--muted)]">
                  {total || threads.length} thread
                  {(total || threads.length) === 1 ? "" : "s"}
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
            </>
          )}
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
