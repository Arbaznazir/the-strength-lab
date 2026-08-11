"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { relativeTime } from "@/lib/format";
import type { Conversation, UserPublic } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { UserAutocomplete } from "@/components/UserAutocomplete";
import { useDmSubscription, useMessagesRealtime } from "@/lib/messagesRealtime";

function previewText(text: string, max = 64) {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

function otherParticipant(
  conversation: Conversation,
  username: string,
): UserPublic | undefined {
  return (
    conversation.participants.find((p) => p.username !== username) ??
    conversation.participants[0]
  );
}

function displayLabel(user: UserPublic | undefined) {
  if (!user) return "Unknown";
  const name = user.displayName?.trim() || user.username;
  if (name.length === 0) return user.username;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function InboxList({ activeId }: { activeId?: string | null }) {
  const { user, refresh } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const to = searchParams.get("to") ?? "";
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(Boolean(to));
  const [username, setUsername] = useState(to);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await apiFetch<{ conversations: Conversation[] }>(
        "/messages",
      );
      setConversations(data.conversations);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load messages");
    }
  }

  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      await load();
      await refresh();
    })();
  }, [user?.id, refresh]);

  useDmSubscription(() => {
    void load();
  });

  const { connected } = useMessagesRealtime();

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch<{ id: string }>("/messages", {
        method: "POST",
        body: {
          username,
          subject: "Chat",
          body,
        },
      });
      setShowNew(false);
      setBody("");
      router.push(`/messages/${res.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not start conversation",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--line)] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="kicker">Inbox</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              Messages
            </h1>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Private conversations.
              {connected ? (
                <span className="ml-1.5 text-[var(--accent)]">· Live</span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary shrink-0 !px-3 !py-1.5 text-xs"
            onClick={() => setShowNew((v) => !v)}
          >
            {showNew ? "Cancel" : "New"}
          </button>
        </div>

        {showNew ? (
          <form
            onSubmit={(e) => void create(e)}
            className="mt-4 space-y-2 border border-[var(--line)] bg-[var(--bg)] p-3"
          >
            <label className="block space-y-1">
              <span className="text-[11px] font-medium text-[var(--muted)]">
                To
              </span>
              <UserAutocomplete
                value={username}
                onChange={setUsername}
                excludeUsername={user.username}
                placeholder="Search members…"
                required
              />
            </label>
            <textarea
              className="field w-full text-sm"
              rows={3}
              placeholder="Write your message…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
            <button type="submit" className="btn-primary text-sm" disabled={busy}>
              Send
            </button>
          </form>
        ) : null}

        {error ? (
          <p className="mt-3 text-xs text-[var(--danger)]">{error}</p>
        ) : null}
      </div>

      <ul className="flex-1 overflow-y-auto">
        {conversations.length ? (
          conversations.map((c) => {
            const other = otherParticipant(c, user.username);
            const preview =
              c.lastMessagePreview || c.subject || "No messages yet";
            const fromMe = c.lastMessageAuthorId === user.id;
            const isActive = activeId === c.id;

            return (
              <li key={c.id} className="border-b border-[var(--line)] last:border-b-0">
                <Link
                  href={`/messages/${c.id}`}
                  className={clsx(
                    "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--accent-dim)]",
                    c.unread &&
                      !isActive &&
                      "bg-[color-mix(in_oklab,var(--accent)_6%,transparent)]",
                    isActive && "bg-[var(--accent-dim)]",
                  )}
                >
                  <Avatar user={other} size="md" link={false} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className={clsx(
                          "truncate text-sm leading-tight",
                          c.unread || isActive
                            ? "font-semibold text-[var(--fg)]"
                            : "font-medium text-[var(--fg)]",
                        )}
                      >
                        {displayLabel(other)}
                      </p>
                      <span className="shrink-0 text-[10px] text-[var(--muted)]">
                        {relativeTime(c.lastMessageAt)}
                      </span>
                    </div>
                    <p
                      className={clsx(
                        "mt-0.5 truncate text-xs leading-snug",
                        c.unread ? "text-[var(--fg)]" : "text-[var(--muted)]",
                      )}
                    >
                      {fromMe ? "You: " : ""}
                      {previewText(preview)}
                    </p>
                  </div>
                  {c.unread && !isActive ? (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
                  ) : null}
                </Link>
              </li>
            );
          })
        ) : (
          <li className="px-4 py-10 text-center text-sm text-[var(--muted)]">
            No conversations yet.{" "}
            <button
              type="button"
              className="text-[var(--accent)] hover:underline"
              onClick={() => setShowNew(true)}
            >
              Start one
            </button>
            .
          </li>
        )}
      </ul>
    </div>
  );
}
