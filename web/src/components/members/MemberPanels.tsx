"use client";

import Link from "next/link";
import clsx from "clsx";
import type { UserPublic } from "@/lib/types";
import { formatCount } from "@/lib/format";
import { Avatar } from "@/components/Avatar";

export type LeaderboardMetric = "messages" | "reactions" | "points";

const metricValue = {
  messages: (m: UserPublic) => m.messageCount,
  reactions: (m: UserPublic) => m.reactionScore,
  points: (m: UserPublic) => m.trophyPoints,
};

export function MemberLeaderboard({
  title,
  members,
  metric,
  seeAllHref,
}: {
  title: string;
  members: UserPublic[];
  metric: LeaderboardMetric;
  seeAllHref: string;
}) {
  const valueOf = metricValue[metric];

  return (
    <section className="border border-[var(--line)] bg-[var(--bg-elevated)]">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <ol className="divide-y divide-[var(--line)]">
        {members.map((member, i) => (
          <li key={member.id}>
            <Link
              href={`/members/${member.username}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--accent-dim)]"
            >
              <span className="w-5 shrink-0 text-xs font-semibold tabular-nums text-[var(--accent)]">
                {i + 1}
              </span>
              <Avatar user={member} size="md" link={false} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{member.displayName}</p>
                <p className="truncate text-xs text-[var(--muted)]">
                  @{member.username}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatCount(valueOf(member))}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="border-t border-[var(--line)] px-4 py-2.5">
        <Link
          href={seeAllHref}
          className="text-xs font-semibold text-[var(--accent)] hover:underline"
        >
          See all →
        </Link>
      </div>
    </section>
  );
}

export function MemberListRow({ member }: { member: UserPublic }) {
  const isStaff =
    member.role === "admin" || member.role === "moderator";

  return (
    <Link
      href={`/members/${member.username}`}
      className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-[var(--accent-dim)] sm:px-5"
    >
      <Avatar user={member} size="lg" link={false} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-medium">{member.displayName}</p>
          {isStaff ? (
            <span
              className={clsx(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                member.role === "admin"
                  ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                  : "bg-[color-mix(in_oklab,var(--staff)_18%,transparent)] text-[var(--staff)]",
              )}
            >
              {member.role}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-sm text-[var(--muted)]">
          @{member.username}
          {member.title ? ` · ${member.title}` : ""}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)] sm:hidden">
          {formatCount(member.messageCount)} msgs · {formatCount(member.trophyPoints)} pts
        </p>
      </div>
      <dl className="hidden shrink-0 gap-4 text-right text-xs sm:grid sm:grid-cols-3">
        <div>
          <dt className="text-[var(--muted)]">Messages</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {formatCount(member.messageCount)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Reactions</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {formatCount(member.reactionScore)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Points</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {formatCount(member.trophyPoints)}
          </dd>
        </div>
      </dl>
    </Link>
  );
}

export function StaffGrid({ staff }: { staff: UserPublic[] }) {
  if (!staff.length) return null;

  return (
    <section className="border border-[var(--line)] bg-[var(--bg-elevated)]">
      <div className="border-b border-[var(--line)] px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold">Staff members</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Moderators and admins keeping the lab running.
        </p>
      </div>
      <div className="grid gap-px bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-3">
        {staff.map((member) => (
          <Link
            key={member.id}
            href={`/members/${member.username}`}
            className="flex items-center gap-3 bg-[var(--bg-elevated)] p-4 transition-colors hover:bg-[var(--accent-dim)]"
          >
            <Avatar user={member} size="lg" link={false} />
            <div className="min-w-0">
              <p className="truncate font-medium">{member.displayName}</p>
              <p
                className={clsx(
                  "mt-0.5 text-xs capitalize",
                  member.role === "admin"
                    ? "text-[var(--accent)]"
                    : "text-[var(--staff)]",
                )}
              >
                {member.role}
              </p>
              {member.title ? (
                <p className="mt-1 truncate text-xs text-[var(--muted)]">
                  {member.title}
                </p>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function NewestMembersGrid({ members }: { members: UserPublic[] }) {
  if (!members.length) return null;

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4">
      {members.map((member) => (
        <Link
          key={member.id}
          href={`/members/${member.username}`}
          title={member.displayName}
          className="group flex flex-col items-center gap-1.5"
        >
          <Avatar
            user={member}
            size="md"
            link={false}
            className="transition-transform group-hover:scale-105"
          />
          <span className="w-full truncate text-center text-[10px] text-[var(--muted)] group-hover:text-[var(--accent)]">
            {member.username}
          </span>
        </Link>
      ))}
    </div>
  );
}
