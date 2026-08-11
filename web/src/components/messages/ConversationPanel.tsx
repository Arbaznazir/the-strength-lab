"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { relativeTime } from "@/lib/format";
import type { Conversation, PrivateMessage } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { MentionInput } from "@/components/MentionInput";
import { renderTextWithMentions } from "@/lib/mentions";
import {
  useDmSubscription,
  useTypingEmitter,
  useTypingSubscription,
} from "@/lib/messagesRealtime";
import { TypingIndicator } from "@/components/messages/TypingIndicator";

function displayLabel(name: string) {
  if (!name) return "Unknown";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function ConversationPanel({ id }: { id: string }) {
  const { user, refresh } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stopTyping = useTypingEmitter(id, body);

  async function load() {
    try {
      const data = await apiFetch<{
        conversation: Conversation;
        messages: PrivateMessage[];
      }>(`/messages/${id}`);
      setConversation(data.conversation);
      setMessages(data.messages);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load conversation");
    }
  }

  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      await load();
      await refresh();
    })();
  }, [user?.id, id, refresh]);

  useEffect(() => {
    setOtherTyping(false);
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, otherTyping]);

  useDmSubscription((payload) => {
    if (payload.conversationId !== id) return;
    if (payload.message.author.username !== user?.username) {
      setOtherTyping(false);
    }
    setMessages((prev) => {
      if (prev.some((m) => m.id === payload.message.id)) return prev;
      return [...prev, payload.message];
    });
  });

  useTypingSubscription((payload) => {
    if (payload.conversationId !== id) return;
    if (payload.userId === user?.id) return;
    setOtherTyping(payload.active);
  });

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    stopTyping();
    setBusy(true);
    try {
      await apiFetch(`/messages/${id}`, {
        method: "POST",
        body: { body },
      });
      setBody("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  const other =
    conversation?.participants.find((p) => p.username !== user.username) ??
    conversation?.participants[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
        <Link
          href="/messages"
          className="text-sm text-[var(--muted)] hover:text-[var(--accent)] md:hidden"
        >
          ← Back
        </Link>
        {other ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar user={other} size="md" link={false} />
            <div className="min-w-0">
              <Link
                href={`/members/${other.username}`}
                className="block truncate font-semibold hover:text-[var(--accent)]"
              >
                {displayLabel(other.displayName || other.username)}
              </Link>
              <p className="truncate text-xs text-[var(--muted)]">
                {otherTyping ? (
                  <span className="text-[var(--accent)]">typing…</span>
                ) : (
                  <>
                    @{other.username}
                    {other.title ? ` · ${other.title}` : ""}
                  </>
                )}
              </p>
            </div>
          </div>
        ) : (
          <h2 className="text-base font-semibold">Conversation</h2>
        )}
      </div>

      {error ? (
        <p className="px-4 py-2 text-sm text-[var(--danger)]">{error}</p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-elevated)]">
        <div className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {messages.length ? (
            messages.map((m) => {
              const mine = m.author.username === user.username;
              return (
                <div
                  key={m.id}
                  className={clsx(
                    "flex gap-2 px-1 py-1",
                    mine ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  {!mine ? (
                    <Avatar user={m.author} size="sm" link={false} />
                  ) : null}
                  <div
                    className={clsx(
                      "max-w-[min(85%,20rem)] rounded-2xl px-3.5 py-2",
                      mine
                        ? "rounded-br-sm bg-[var(--accent)] text-[var(--bg)]"
                        : "rounded-bl-sm bg-[var(--bg)]",
                    )}
                  >
                    {!mine ? (
                      <p className="mb-0.5 text-[10px] font-medium opacity-70">
                        {displayLabel(
                          m.author.displayName || m.author.username,
                        )}
                      </p>
                    ) : null}
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {renderTextWithMentions(m.body)}
                    </p>
                    <p
                      className={clsx(
                        "mt-1 text-[10px]",
                        mine ? "text-[color-mix(in_oklab,var(--bg)_70%,transparent)]" : "text-[var(--muted)]",
                      )}
                    >
                      {relativeTime(m.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="py-12 text-center text-sm text-[var(--muted)]">
              No messages yet. Say hello.
            </p>
          )}
          {otherTyping && other ? (
            <TypingIndicator
              name={displayLabel(other.displayName || other.username)}
            />
          ) : null}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => void reply(e)}
          className="flex gap-2 border-t border-[var(--line)] bg-[var(--bg)] p-3 safe-bottom"
        >
          <MentionInput
            value={body}
            onChange={setBody}
            placeholder="Type a message…"
            excludeUsername={user.username}
            className="!py-2.5 text-sm"
            required
          />
          <button
            type="submit"
            className="btn-primary shrink-0 !px-4 !py-2 text-sm"
            disabled={busy || !body.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
