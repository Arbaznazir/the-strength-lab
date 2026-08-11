"use client";

type AdminPaginationProps = {
  page: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
};

export function AdminPagination({ page, total, limit, onPage }: AdminPaginationProps) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;

  const start = Math.max(1, page - 2);
  const end = Math.min(pages, page + 2);
  const nums: number[] = [];
  for (let i = start; i <= end; i++) nums.push(i);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
      <p className="text-xs text-[var(--muted)]">
        Page {page} of {pages} · {total} total
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="border border-[var(--line)] px-2.5 py-1 text-xs disabled:opacity-40 hover:border-[var(--accent)]"
        >
          Prev
        </button>
        {start > 1 ? (
          <>
            <button
              type="button"
              onClick={() => onPage(1)}
              className="border border-[var(--line)] px-2.5 py-1 text-xs hover:border-[var(--accent)]"
            >
              1
            </button>
            {start > 2 ? <span className="px-1 text-xs text-[var(--muted)]">…</span> : null}
          </>
        ) : null}
        {nums.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPage(n)}
            className={
              n === page
                ? "border border-[var(--accent)] bg-[var(--accent-dim)] px-2.5 py-1 text-xs font-medium"
                : "border border-[var(--line)] px-2.5 py-1 text-xs hover:border-[var(--accent)]"
            }
          >
            {n}
          </button>
        ))}
        {end < pages ? (
          <>
            {end < pages - 1 ? <span className="px-1 text-xs text-[var(--muted)]">…</span> : null}
            <button
              type="button"
              onClick={() => onPage(pages)}
              className="border border-[var(--line)] px-2.5 py-1 text-xs hover:border-[var(--accent)]"
            >
              {pages}
            </button>
          </>
        ) : null}
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="border border-[var(--line)] px-2.5 py-1 text-xs disabled:opacity-40 hover:border-[var(--accent)]"
        >
          Next
        </button>
      </div>
    </div>
  );
}
