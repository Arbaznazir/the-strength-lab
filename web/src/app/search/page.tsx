"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Hash, Search, User } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { SearchResponse } from "@/lib/types";
import { ThreadList } from "@/components/ThreadList";
import { Avatar } from "@/components/Avatar";

function SearchInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initial = searchParams.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  async function runSearch(query: string) {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setError("Enter at least 2 characters");
      return;
    }
    setError("");
    setSearched(true);
    try {
      const res = await apiFetch<SearchResponse>(
        `/search?q=${encodeURIComponent(trimmed)}`,
        { auth: false },
      );
      setData(res);
      router.replace(`/search?q=${encodeURIComponent(trimmed)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setData(null);
    }
  }

  useEffect(() => {
    if (initial.trim().length >= 2) {
      void runSearch(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasResults =
    !!data &&
    (data.members.length > 0 || data.threads.length > 0 || data.forums.length > 0);

  return (
    <div className="container-lab mx-auto max-w-2xl space-y-6 py-8 sm:py-10">
      <div>
        <p className="kicker">Find</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Search
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Search members, threads, and forums. Try{" "}
          <button
            type="button"
            className="text-[var(--accent)] hover:underline"
            onClick={() => {
              setQ("@coach");
              void runSearch("@coach");
            }}
          >
            @coach
          </button>{" "}
          or multi-word queries like{" "}
          <button
            type="button"
            className="text-[var(--accent)] hover:underline"
            onClick={() => {
              setQ("deadlift programming");
              void runSearch("deadlift programming");
            }}
          >
            deadlift programming
          </button>
          .
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch(q);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            className="field w-full pl-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Members, threads, forums… (@username)"
          />
        </div>
        <button type="submit" className="btn-primary shrink-0">
          Search
        </button>
      </form>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {searched && data ? (
        <div className="space-y-8">
          <p className="text-sm text-[var(--muted)]">
            {hasResults
              ? `${data.total} result${data.total === 1 ? "" : "s"} for “${data.query}”`
              : `No results for “${data.query}”`}
          </p>

          {data.members.length > 0 ? (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <User className="h-4 w-4 text-[var(--muted)]" />
                Members
              </h2>
              <ul className="space-y-2">
                {data.members.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/members/${m.username}`}
                      className="flex items-center gap-3 border border-[var(--line)] bg-[var(--bg-elevated)] p-3 hover:border-[var(--accent)]"
                    >
                      <Avatar user={m} size="sm" link={false} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{m.displayName}</p>
                        <p className="truncate text-sm text-[var(--muted)]">
                          @{m.username}
                          {m.title ? ` · ${m.title}` : ""}
                        </p>
                        {m.bio ? (
                          <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
                            {m.bio}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.forums.length > 0 ? (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Hash className="h-4 w-4 text-[var(--muted)]" />
                Forums
              </h2>
              <ul className="space-y-2">
                {data.forums.map((f) => (
                  <li key={f.slug}>
                    <Link
                      href={`/forums/${f.slug}`}
                      className="block border border-[var(--line)] bg-[var(--bg-elevated)] p-3 hover:border-[var(--accent)]"
                    >
                      <p className="font-medium">{f.name}</p>
                      <p className="text-xs text-[var(--muted)]">{f.category}</p>
                      {f.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
                          {f.description}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.threads.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-base font-semibold">Threads</h2>
              <ThreadList threads={data.threads} />
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <p className="container-lab py-8 text-[var(--muted)] sm:py-10">
          Loading search…
        </p>
      }
    >
      <SearchInner />
    </Suspense>
  );
}
