"use client";

import clsx from "clsx";
import { PAGE_SIZE } from "@/lib/pagination";

type PaginationProps = {
  page: number;
  total: number;
  pages?: number;
  limit?: number;
  onPage: (page: number) => void;
  className?: string;
};

export function Pagination({
  page,
  total,
  pages: pagesProp,
  limit = PAGE_SIZE,
  onPage,
  className,
}: PaginationProps) {
  const pages = Math.max(
    1,
    pagesProp ?? Math.ceil(total / limit),
  );
  if (pages <= 1) return null;

  const start = Math.max(1, page - 2);
  const end = Math.min(pages, page + 2);

  return (
    <nav
      className={clsx("flex flex-wrap items-center justify-between gap-3", className)}
      aria-label="Pagination"
    >
      <p className="text-xs text-[var(--muted)]">
        Page {page} of {pages} · {total} total
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="border border-[var(--line)] px-3 py-1.5 text-sm font-semibold disabled:opacity-40 hover:border-[var(--accent)]"
        >
          Prev
        </button>
        {start > 1 ? (
          <>
            <button
              type="button"
              onClick={() => onPage(1)}
              className="min-w-9 border border-[var(--line)] px-3 py-1.5 text-sm font-semibold hover:border-[var(--accent)]"
            >
              1
            </button>
            {start > 2 ? (
              <span className="px-1 text-xs text-[var(--muted)]">…</span>
            ) : null}
          </>
        ) : null}
        {Array.from({ length: end - start + 1 }, (_, i) => start + i).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPage(n)}
            className={clsx(
              "min-w-9 border px-3 py-1.5 text-sm font-semibold",
              n === page
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]"
                : "border-[var(--line)] hover:border-[var(--accent)]",
            )}
          >
            {n}
          </button>
        ))}
        {end < pages ? (
          <>
            {end < pages - 1 ? (
              <span className="px-1 text-xs text-[var(--muted)]">…</span>
            ) : null}
            <button
              type="button"
              onClick={() => onPage(pages)}
              className="min-w-9 border border-[var(--line)] px-3 py-1.5 text-sm font-semibold hover:border-[var(--accent)]"
            >
              {pages}
            </button>
          </>
        ) : null}
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="border border-[var(--line)] px-3 py-1.5 text-sm font-semibold disabled:opacity-40 hover:border-[var(--accent)]"
        >
          Next
        </button>
      </div>
    </nav>
  );
}
