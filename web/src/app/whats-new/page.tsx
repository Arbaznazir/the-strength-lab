"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import type { ProfilePost, Thread } from "@/lib/types";
import { ThreadList } from "@/components/ThreadList";
import { Avatar } from "@/components/Avatar";
import { Sidebar } from "@/components/Sidebar";
import { renderTextWithMentions } from "@/lib/mentions";
import { useLiveClock } from "@/hooks/useLiveClock";

export default function WhatsNewPage() {
  const [latest, setLatest] = useState<Thread[]>([]);
  const [featured, setFeatured] = useState<Thread[]>([]);
  const [profilePosts, setProfilePosts] = useState<ProfilePost[]>([]);
  const [error, setError] = useState("");
  useLiveClock(30_000);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await apiFetch<{
          latestThreads: Thread[];
          profilePosts: ProfilePost[];
          featured: Thread[];
        }>("/whats-new", { auth: false });
        if (!cancelled) {
          setLatest(data.latestThreads);
          setFeatured(data.featured);
          setProfilePosts(data.profilePosts);
          setError("");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      }
    };

    void load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="container-lab space-y-8 py-8 sm:py-10">
      <div>
        <p className="kicker">Feed</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          What&apos;s new
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Latest threads, featured lifts, and profile activity.
        </p>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_13rem] md:gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8">
        <div className="space-y-8">
          {featured.length ? (
            <section>
              <h2 className="mb-3 text-base font-semibold">
                Featured
              </h2>
              <ThreadList threads={featured} />
            </section>
          ) : null}

          <section>
            <h2 className="mb-3 text-base font-semibold">
              Latest activity
            </h2>
            <ThreadList threads={latest} empty="Nothing new yet." />
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">
              Profile posts
            </h2>
            {profilePosts.length ? (
              <ul className="space-y-3">
                {profilePosts.map((p) => (
                  <li
                    key={p.id}
                    className="border border-[var(--line)] bg-[var(--bg-elevated)] p-4"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Avatar user={p.author} size="sm" />
                      <div>
                        <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
                          <Link
                            href={`/members/${p.author.username}`}
                            className="font-medium hover:text-[var(--accent)]"
                          >
                            {p.author.displayName}
                          </Link>
                          {p.profileUser ? (
                            <>
                              <span className="text-[var(--muted)]">on</span>
                              <Link
                                href={`/members/${p.profileUser.username}`}
                                className="font-medium hover:text-[var(--accent)]"
                              >
                                {p.profileUser.displayName}&apos;s profile
                              </Link>
                            </>
                          ) : null}
                        </div>
                        <p className="text-xs text-[var(--muted)]">
                          {relativeTime(p.createdAt)}
                        </p>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">
                      {renderTextWithMentions(p.body)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[var(--muted)]">No profile posts yet.</p>
            )}
          </section>
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
