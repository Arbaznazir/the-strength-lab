"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { UserPublic } from "@/lib/types";

export function useMemberSuggest(query: string, excludeUsername?: string) {
  const [results, setResults] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiFetch<{ members: UserPublic[] }>(
          `/members?q=${encodeURIComponent(q)}&limit=8`,
          { auth: false },
        );
        if (!cancelled) {
          setResults(
            data.members.filter((m) => m.username !== excludeUsername),
          );
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, excludeUsername]);

  return { results, loading };
}

export function mentionQueryAt(
  text: string,
  cursor: number,
): { query: string; start: number } | null {
  const before = text.slice(0, cursor);
  const match = before.match(/@([a-zA-Z0-9_]*)$/);
  if (!match) return null;
  return {
    query: match[1],
    start: cursor - match[1].length - 1,
  };
}
