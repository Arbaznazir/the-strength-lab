"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ChevronDown, Hash, MessageSquareText, Search, User } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import type { Category, SearchResponse, SearchThreadHit } from "@/lib/types";
import { Avatar } from "@/components/Avatar";

type Scope = "all" | "threads" | "members" | "forums" | "profile";
type Sort = "relevance" | "date" | "replies";

const scopes: { id: Scope; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "threads", label: "Threads" },
  { id: "members", label: "Members" },
  { id: "forums", label: "Forums" },
  { id: "profile", label: "Profile posts" },
];

function Highlight({ html }: { html: string }) {
  // Only allow <mark> from our API headlines — strip everything else
  const safe = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;mark&gt;/g, "<mark>")
    .replace(/&lt;\/mark&gt;/g, "</mark>");
  return (
    <span
      className="search-snippet text-sm text-[var(--muted)] [&_mark]:bg-[var(--accent-dim)] [&_mark]:text-[var(--accent)] [&_mark]:font-medium"
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}

function SearchInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [scope, setScope] = useState<Scope>((searchParams.get("scope") as Scope) || "all");
  const [sort, setSort] = useState<Sort>((searchParams.get("sort") as Sort) || "relevance");
  const [titlesOnly, setTitlesOnly] = useState(searchParams.get("titlesOnly") === "1");
  const [author, setAuthor] = useState(searchParams.get("author") ?? "");
  const [after, setAfter] = useState(searchParams.get("after") ?? "");
  const [before, setBefore] = useState(searchParams.get("before") ?? "");
  const [minReplies, setMinReplies] = useState(searchParams.get("minReplies") ?? "");
  const [forumSlugs, setForumSlugs] = useState<string[]>(
    (searchParams.get("forums") ?? "").split(",").filter(Boolean),
  );
  const [filtersOpen, setFiltersOpen] = useState(
    Boolean(
      searchParams.get("author") ||
        searchParams.get("after") ||
        searchParams.get("before") ||
        searchParams.get("minReplies") ||
        searchParams.get("forums") ||
        searchParams.get("titlesOnly"),
    ),
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    void apiFetch<{ categories: Category[] }>("/forums", { auth: false })
      .then((data) => setCategories(Array.isArray(data.categories) ? data.categories : []))
      .catch(() => setCategories([]));
  }, []);

  const forumOptions = useMemo(
    () =>
      (Array.isArray(categories) ? categories : []).flatMap((c) =>
        (c.forums ?? []).map((f) => ({ slug: f.slug, name: f.name, category: c.name })),
      ),
    [categories],
  );

  function buildParams(overrides?: Partial<{ q: string; scope: Scope; sort: Sort }>) {
    const params = new URLSearchParams();
    const query = (overrides?.q ?? q).trim();
    const sc = overrides?.scope ?? scope;
    const so = overrides?.sort ?? sort;
    if (query) params.set("q", query);
    if (sc !== "all") params.set("scope", sc);
    if (so !== "relevance") params.set("sort", so);
    if (titlesOnly) params.set("titlesOnly", "1");
    if (author.trim()) params.set("author", author.trim().replace(/^@/, ""));
    if (after) params.set("after", after);
    if (before) params.set("before", before);
    if (minReplies && Number(minReplies) > 0) params.set("minReplies", String(Number(minReplies)));
    if (forumSlugs.length) params.set("forums", forumSlugs.join(","));
    return params;
  }

  async function runSearch(overrides?: Partial<{ q: string; scope: Scope; sort: Sort }>) {
    const params = buildParams(overrides);
    const query = params.get("q") ?? "";
    if (query.length < 2 && !params.get("author") && !params.get("forums")) {
      setError("Enter at least 2 characters, or filter by author / forums");
      return;
    }
    setError("");
    setBusy(true);
    setSearched(true);
    try {
      const res = await apiFetch<SearchResponse>(`/search?${params}`, { auth: false });
      setData(res);
      router.replace(`/search?${params}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const initial = searchParams.get("q") ?? "";
    if (initial.trim().length >= 2 || searchParams.get("author") || searchParams.get("forums")) {
      void runSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleForum(slug: string) {
    setForumSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  const hasResults =
    !!data &&
    (data.members.length > 0 ||
      data.threads.length > 0 ||
      data.forums.length > 0 ||
      (data.profilePosts?.length ?? 0) > 0);

  return (
    <div className="container-lab mx-auto max-w-3xl space-y-6 py-8 sm:py-10">
      <div>
        <p className="kicker">Find</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Smart search
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Full-text ranking, typo tolerance, synonyms (try{" "}
          <button
            type="button"
            className="text-[var(--accent)] hover:underline"
            onClick={() => {
              setQ("dl programming");
              void runSearch({ q: "dl programming" });
            }}
          >
            dl programming
          </button>
          ), and operators like{" "}
          <code className="text-[var(--accent)]">from:coach</code>,{" "}
          <code className="text-[var(--accent)]">in:programs</code>,{" "}
          <code className="text-[var(--accent)]">minreplies:5</code>,{" "}
          <code className="text-[var(--accent)]">&quot;exact phrase&quot;</code>.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[var(--line)]">
        {scopes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setScope(s.id);
              if (searched) void runSearch({ scope: s.id });
            }}
            className={clsx(
              "px-3 py-2 text-sm font-medium transition-colors",
              scope === s.id
                ? "border-b-2 border-[var(--accent)] text-[var(--fg)]"
                : "text-[var(--muted)] hover:text-[var(--fg)]",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch();
        }}
        className="space-y-4"
      >
        <div className="flex overflow-hidden rounded border border-[var(--line)] bg-[var(--bg)] transition-[border-color,box-shadow] focus-within:border-[color-mix(in_oklab,var(--accent)_60%,var(--line))] focus-within:shadow-[0_0_0_3px_var(--accent-dim)]">
          <div className="relative flex min-w-0 flex-1 items-center">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
              aria-hidden
            />
            <input
              className="w-full min-w-0 border-0 bg-transparent py-3 pl-11 pr-3 text-[0.925rem] text-[var(--fg)] outline-none placeholder:text-[var(--muted)]"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Keywords, @user, from:spotter, title: squat…"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="btn-primary shrink-0 rounded-none border-0 !px-5 !py-3"
            disabled={busy}
          >
            {busy ? "…" : "Search"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <input
              type="checkbox"
              checked={titlesOnly}
              onChange={(e) => setTitlesOnly(e.target.checked)}
            />
            Titles only
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            Sort
            <select
              value={sort}
              onChange={(e) => {
                const v = e.target.value as Sort;
                setSort(v);
                if (searched) void runSearch({ sort: v });
              }}
              className="border border-[var(--line)] bg-[var(--bg)] px-2 py-1 text-sm text-[var(--fg)]"
            >
              <option value="relevance">Relevance</option>
              <option value="date">Newest activity</option>
              <option value="replies">Most replies</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-sm text-[var(--accent)] hover:underline"
          >
            Filters
            <ChevronDown className={clsx("h-3.5 w-3.5 transition", filtersOpen && "rotate-180")} />
          </button>
        </div>

        {filtersOpen ? (
          <div className="space-y-4 border border-[var(--line)] bg-[var(--bg-elevated)] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Posted by
                </span>
                <input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="username"
                  className="field w-full"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Min replies
                </span>
                <input
                  type="number"
                  min={0}
                  value={minReplies}
                  onChange={(e) => setMinReplies(e.target.value)}
                  placeholder="0"
                  className="field w-full"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Newer than
                </span>
                <input
                  type="date"
                  value={after}
                  onChange={(e) => setAfter(e.target.value)}
                  className="field w-full"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Older than
                </span>
                <input
                  type="date"
                  value={before}
                  onChange={(e) => setBefore(e.target.value)}
                  className="field w-full"
                />
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                Search in forums
              </p>
              <div className="max-h-40 overflow-y-auto border border-[var(--line)] bg-[var(--bg)] p-2">
                {forumOptions.map((f) => (
                  <label
                    key={f.slug}
                    className="flex cursor-pointer items-start gap-2 px-1 py-1 text-sm hover:bg-[var(--accent-dim)]"
                  >
                    <input
                      type="checkbox"
                      checked={forumSlugs.includes(f.slug)}
                      onChange={() => toggleForum(f.slug)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-medium">{f.name}</span>
                      <span className="text-xs text-[var(--muted)]"> · {f.category}</span>
                    </span>
                  </label>
                ))}
                {!forumOptions.length ? (
                  <p className="px-1 py-2 text-xs text-[var(--muted)]">Loading forums…</p>
                ) : null}
              </div>
              {forumSlugs.length ? (
                <button
                  type="button"
                  className="text-xs text-[var(--muted)] hover:text-[var(--accent)]"
                  onClick={() => setForumSlugs([])}
                >
                  Clear forum filter
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </form>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {data?.suggestions?.length ? (
        <div className="flex flex-wrap gap-2">
          {data.suggestions.map((s) => (
            <button
              key={s.query}
              type="button"
              className="border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--fg)]"
              onClick={() => {
                setQ(s.query);
                void runSearch({ q: s.query });
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}

      {searched && data ? (
        <div className="space-y-8">
          <p className="text-sm text-[var(--muted)]">
            {hasResults
              ? `${data.total} result${data.total === 1 ? "" : "s"}`
              : "No results"}
            {data.query ? ` for “${data.query}”` : ""}
            {data.parsed?.terms?.length ? (
              <span className="text-[var(--muted)]">
                {" "}
                · matched {data.parsed.terms.slice(0, 6).join(", ")}
              </span>
            ) : null}
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
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <MessageSquareText className="h-4 w-4 text-[var(--muted)]" />
                Threads
              </h2>
              <ul className="divide-y divide-[var(--line)] border border-[var(--line)] bg-[var(--bg-elevated)]">
                {data.threads.map((t: SearchThreadHit) => (
                  <li key={t.id} className="space-y-1.5 px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link
                        href={`/threads/${t.slug}`}
                        className="font-medium hover:text-[var(--accent)]"
                      >
                        {t.title}
                      </Link>
                      <span className="text-xs text-[var(--muted)]">
                        {t.replyCount} replies · {relativeTime(t.lastPostAt || t.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--muted)]">
                      in{" "}
                      <Link href={`/forums/${t.forumSlug}`} className="hover:text-[var(--accent)]">
                        {t.forumName}
                      </Link>
                      {" · "}
                      @{t.author.username}
                    </p>
                    {t.snippet ? <Highlight html={t.snippet} /> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.profilePosts && data.profilePosts.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-base font-semibold">Profile posts</h2>
              <ul className="space-y-2">
                {data.profilePosts.map((p) => (
                  <li
                    key={p.id}
                    className="border border-[var(--line)] bg-[var(--bg-elevated)] p-3"
                  >
                    <p className="text-xs text-[var(--muted)]">
                      <Link
                        href={`/members/${p.author.username}`}
                        className="font-medium text-[var(--fg)] hover:text-[var(--accent)]"
                      >
                        @{p.author.username}
                      </Link>
                      {" → "}
                      <Link
                        href={`/members/${p.profileUser.username}`}
                        className="hover:text-[var(--accent)]"
                      >
                        @{p.profileUser.username}
                      </Link>
                      {" · "}
                      {relativeTime(p.createdAt)}
                    </p>
                    <div className="mt-1">
                      {p.snippet ? <Highlight html={p.snippet} /> : (
                        <p className="text-sm">{p.body}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
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
        <p className="container-lab py-8 text-[var(--muted)] sm:py-10">Loading search…</p>
      }
    >
      <SearchInner />
    </Suspense>
  );
}
