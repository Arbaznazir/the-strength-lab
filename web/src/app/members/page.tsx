"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatCount } from "@/lib/format";
import type { UserPublic } from "@/lib/types";
import {
  MemberLeaderboard,
  MemberListRow,
  StaffGrid,
} from "@/components/members/MemberPanels";
import {
  MembersSidebar,
  type MembersView,
} from "@/components/members/MembersSidebar";

type OverviewPayload = {
  totalMembers: number;
  topMessages: UserPublic[];
  topReactions: UserPublic[];
  topPoints: UserPublic[];
  newest: UserPublic[];
  staff: UserPublic[];
};

const viewTitles: Record<Exclude<MembersView, "overview">, string> = {
  messages: "Most messages",
  reactions: "Highest reaction score",
  points: "Most points",
  staff: "Staff members",
};

const sortByView: Record<Exclude<MembersView, "overview">, string> = {
  messages: "messages",
  reactions: "reactions",
  points: "points",
  staff: "staff",
};

function parseView(raw: string | null): MembersView {
  if (
    raw === "messages" ||
    raw === "reactions" ||
    raw === "points" ||
    raw === "staff"
  ) {
    return raw;
  }
  return "overview";
}

function MembersInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const view = parseView(searchParams.get("view"));
  const query = searchParams.get("q")?.trim() ?? "";

  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [members, setMembers] = useState<UserPublic[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        if (query.length >= 2) {
          const data = await apiFetch<{ members: UserPublic[] }>(
            `/members?q=${encodeURIComponent(query)}&limit=50`,
            { auth: false },
          );
          if (!cancelled) {
            setMembers(data.members);
            if (!overview) {
              const ov = await apiFetch<OverviewPayload>("/members/overview", {
                auth: false,
              });
              setOverview(ov);
            }
          }
        } else if (view === "overview") {
          const data = await apiFetch<OverviewPayload>("/members/overview", {
            auth: false,
          });
          if (!cancelled) {
            setOverview(data);
            setMembers([]);
          }
        } else {
          const sort = sortByView[view];
          const data = await apiFetch<{ members: UserPublic[] }>(
            `/members?sort=${sort}&limit=50`,
            { auth: false },
          );
          if (!cancelled) {
            setMembers(data.members);
            if (!overview) {
              const ov = await apiFetch<OverviewPayload>("/members/overview", {
                auth: false,
              });
              setOverview(ov);
            }
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load members");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, query]);

  const sidebarNewest = overview?.newest ?? [];
  const staff = overview?.staff ?? [];

  return (
    <div className="container-lab py-8 sm:py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Community</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Members
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            {overview
              ? `${formatCount(overview.totalMembers)} lifters in the lab`
              : "The lifters putting in the work."}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[11.5rem_minmax(0,1fr)] md:gap-5 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
        <MembersSidebar
          active={query.length >= 2 ? "overview" : view}
          newest={sidebarNewest}
          initialQuery={query}
        />

        <div className="min-w-0 space-y-6">
          {error ? (
            <p className="text-sm text-[var(--danger)]">{error}</p>
          ) : null}

          {loading ? (
            <p className="text-[var(--muted)]">Loading members…</p>
          ) : query.length >= 2 ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold">
                  Search results for &ldquo;{query}&rdquo;
                </h2>
                <button
                  type="button"
                  onClick={() => router.push("/members")}
                  className="text-xs font-semibold text-[var(--accent)] hover:underline"
                >
                  Clear search
                </button>
              </div>
              {members.length ? (
                <ul className="divide-y divide-[var(--line)] overflow-hidden border border-[var(--line)] bg-[var(--bg-elevated)]">
                  {members.map((member) => (
                    <li key={member.id}>
                      <MemberListRow member={member} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[var(--muted)]">No members matched.</p>
              )}
            </section>
          ) : view === "overview" && overview ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <MemberLeaderboard
                  title="Most messages"
                  members={overview.topMessages}
                  metric="messages"
                  seeAllHref="/members?view=messages"
                />
                <MemberLeaderboard
                  title="Highest reaction score"
                  members={overview.topReactions}
                  metric="reactions"
                  seeAllHref="/members?view=reactions"
                />
                <MemberLeaderboard
                  title="Most points"
                  members={overview.topPoints}
                  metric="points"
                  seeAllHref="/members?view=points"
                />
              </div>
              <StaffGrid staff={staff} />
            </>
          ) : view === "staff" ? (
            <StaffGrid staff={members.length ? members : staff} />
          ) : (
            <section className="space-y-4">
              <h2 className="text-base font-semibold">{viewTitles[view]}</h2>
              <ul className="divide-y divide-[var(--line)] overflow-hidden border border-[var(--line)] bg-[var(--bg-elevated)]">
                {members.map((member, i) => (
                  <li
                    key={member.id}
                    className="stagger-item"
                    style={{ animationDelay: `${i * 20}ms` }}
                  >
                    <MemberListRow member={member} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MembersPage() {
  return (
    <Suspense
      fallback={
        <p className="container-lab py-8 text-[var(--muted)] sm:py-10">
          Loading members…
        </p>
      }
    >
      <MembersInner />
    </Suspense>
  );
}
