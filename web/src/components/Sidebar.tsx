"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatCount, formatMemberCount, relativeTime } from "@/lib/format";
import type {
  ForumStats,
  OnlineStats,
  Thread,
  UserPublic,
} from "@/lib/types";
import { Avatar } from "./Avatar";
import { RoleBadge } from "./TagBadge";
import { TrustedStoresSideBlock } from "./TrustedStores";

type StatsPayload = {
  forum: ForumStats;
  online: OnlineStats;
  staff: UserPublic[];
};

export function Sidebar() {
  const [trending, setTrending] = useState<Thread[]>([]);
  const [stats, setStats] = useState<StatsPayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTrending = async () => {
      try {
        const t = await apiFetch<{ trending: Thread[] }>("/trending", {
          auth: false,
        });
        if (!cancelled) setTrending(t.trending);
      } catch {
        /* optional */
      }
    };

    const loadStats = async () => {
      try {
        const s = await apiFetch<StatsPayload>("/stats", { auth: false });
        if (!cancelled) setStats(s);
      } catch {
        /* optional */
      }
    };

    loadTrending();
    loadStats();
    const onlineTimer = setInterval(loadStats, 30_000);

    return () => {
      cancelled = true;
      clearInterval(onlineTimer);
    };
  }, []);

  return (
    <aside className="space-y-0 md:sticky md:top-24 md:self-start lg:sticky lg:top-24">
      <SideBlock title="Trending">
        {trending.length ? (
          <ol className="space-y-4">
            {trending.slice(0, 5).map((t, i) => (
              <li key={t.id} className="flex gap-3">
                <span className="text-sm font-semibold tabular-nums text-[var(--accent)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <Link
                    href={`/threads/${t.slug}`}
                    className="block text-sm font-medium leading-snug text-[var(--fg)] transition-colors hover:text-[var(--accent)]"
                  >
                    {t.title}
                  </Link>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">
                    {t.replyCount} replies · {relativeTime(t.lastPostAt)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        )}
      </SideBlock>

      <TrustedStoresSideBlock />

      {stats ? (
        <>
          <SideBlock title="Lab pulse">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-4">
              <Stat label="Threads" value={formatCount(stats.forum.threads)} />
              <Stat label="Messages" value={formatCount(stats.forum.messages)} />
              <Stat label="Members" value={formatMemberCount(stats.forum.members)} />
              <div>
                <dt className="kicker !text-[0.62rem]">Newest</dt>
                <dd className="mt-1 text-sm font-medium">
                  {stats.forum.latestMember ? (
                    <Link
                      href={`/members/${stats.forum.latestMember.username}`}
                      className="hover:text-[var(--accent)]"
                    >
                      {stats.forum.latestMember.displayName}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </SideBlock>

          <SideBlock title="Online">
            <p className="text-3xl font-semibold tabular-nums tracking-tight text-[var(--fg)]">
              {stats.online.total}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {stats.online.members} members · {stats.online.guests} guests
            </p>
          </SideBlock>

          <SideBlock title="Staff">
            {stats.staff.length ? (
              <ul className="space-y-3">
                {stats.staff.map((s) => (
                  <li key={s.id} className="flex items-center gap-2.5">
                    <Avatar user={s} size="sm" />
                    <div className="min-w-0">
                      <Link
                        href={`/members/${s.username}`}
                        className="block truncate text-sm font-medium hover:text-[var(--accent)]"
                      >
                        {s.displayName}
                      </Link>
                      <div className="mt-0.5">
                        <RoleBadge role={s.role} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--muted)]">No staff online</p>
            )}
          </SideBlock>
        </>
      ) : null}
    </aside>
  );
}

function SideBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="side-panel">
      <h3 className="kicker mb-4">{title}</h3>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="kicker !text-[0.62rem]">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
        {value}
      </dd>
    </div>
  );
}
