"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Share2 } from "lucide-react";
import { apiFetch, chatWsUrl, getToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { relativeTime } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { MentionInput } from "@/components/MentionInput";
import { ShareBar } from "@/components/ShareBar";
import { ShareModal } from "@/components/ShareModal";
import { renderTextWithMentions } from "@/lib/mentions";
import { chatMessageShareURL, chatShareURL } from "@/lib/site";

function messageIdFromHash() {
  if (typeof window === "undefined") return "";
  const m = window.location.hash.match(/^#msg-(.+)$/);
  return m?.[1] ?? "";
}

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [messageShare, setMessageShare] = useState<ChatMessage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingHashRef = useRef("");

  async function load() {
    try {
      const data = await apiFetch<{ messages: ChatMessage[] }>("/chat", {
        auth: false,
      });
      setMessages(data.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chat");
    }
  }

  useEffect(() => {
    pendingHashRef.current = messageIdFromHash();
    void load();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const hashMsg = pendingHashRef.current || messageIdFromHash();
    if (!hashMsg || !messages.length) return;
    const el = document.getElementById(`msg-${hashMsg}`);
    if (el) {
      window.requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-[var(--accent)]");
        window.setTimeout(() => {
          el.classList.remove("ring-2", "ring-[var(--accent)]");
        }, 2500);
      });
      pendingHashRef.current = "";
    }
  }, [messages]);

  useEffect(() => {
    if (!user) return;
    const token = getToken();
    if (!token) return;

    let ws: WebSocket | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let closed = false;

    try {
      ws = new WebSocket(chatWsUrl(token));
      ws.onopen = () => {
        if (!closed) setLive(true);
      };
      ws.onclose = () => {
        if (!closed) setLive(false);
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data as string) as {
            type?: string;
            message?: ChatMessage;
          };
          if (data.type === "chat" && data.message) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === data.message!.id)) return prev;
              return [...prev, data.message!];
            });
          }
        } catch {
          /* ignore */
        }
      };
    } catch {
      /* fall back to polling */
    }

    poll = setInterval(() => {
      if (!live) void load();
    }, 8000);

    return () => {
      closed = true;
      ws?.close();
      if (poll) clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !body.trim()) return;
    setBusy(true);
    setError("");
    try {
      const msg = await apiFetch<ChatMessage>("/chat", {
        method: "POST",
        body: { body },
      });
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-lab mx-auto flex max-w-2xl flex-col gap-3 py-8 sm:py-10">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="kicker">Live</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Chat
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Live locker-room chatter.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="btn-ghost !px-3 !py-2 text-xs"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
          <span
            className={`px-2 py-0.5 text-[11px] font-medium ${
              live
                ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                : "border border-[var(--line)] text-[var(--muted)]"
            }`}
          >
            {live ? "Live" : "Polling"}
          </span>
        </div>
      </div>

      <div className="flex h-[min(70vh,640px)] flex-col overflow-hidden border border-[var(--line)] bg-[var(--bg-elevated)]">
        <div className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {messages.map((m) => {
            const mine = user?.username === m.author.username;
            return (
              <div
                key={m.id}
                id={`msg-${m.id}`}
                className={`group flex scroll-mt-24 gap-2 rounded-sm px-2 py-1.5 ${
                  mine
                    ? "bg-[color-mix(in_oklab,var(--accent)_6%,transparent)]"
                    : "hover:bg-[var(--accent-dim)]"
                }`}
              >
                <Avatar user={m.author} size="sm" />
                <div className="min-w-0 flex-1 leading-snug">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                    <Link
                      href={`/members/${m.author.username}`}
                      className="text-[13px] font-semibold hover:text-[var(--accent)]"
                    >
                      {m.author.displayName}
                    </Link>
                    <span className="text-[10px] text-[var(--muted)]">
                      {relativeTime(m.createdAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMessageShare(m)}
                      className="ml-auto rounded p-0.5 text-[var(--muted)] opacity-0 transition-opacity hover:text-[var(--accent)] group-hover:opacity-100 sm:opacity-100"
                      aria-label="Share message"
                      title="Share message"
                    >
                      <Share2 className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-[13px] text-[var(--fg)]">
                    {renderTextWithMentions(m.body)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {user ? (
          <form
            onSubmit={(e) => void send(e)}
            className="flex gap-2 border-t border-[var(--line)] bg-[var(--bg)] p-2 safe-bottom"
          >
            <MentionInput
              value={body}
              onChange={setBody}
              placeholder="Say something… (@ to mention)"
              maxLength={500}
              excludeUsername={user.username}
              className="!py-2 text-sm"
            />
            <button
              type="submit"
              className="btn-primary shrink-0 !px-3 !py-2 text-sm"
              disabled={busy}
            >
              Send
            </button>
          </form>
        ) : (
          <p className="border-t border-[var(--line)] p-3 text-sm text-[var(--muted)]">
            <Link href="/login" className="text-[var(--accent)] hover:underline">
              Log in
            </Link>{" "}
            to chat.
          </p>
        )}
      </div>

      <ShareBar url={chatShareURL()} title="The Strength Lab Chat" />

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        url={chatShareURL()}
        title="The Strength Lab Chat"
        label="Share chat"
      />

      <ShareModal
        open={!!messageShare}
        onClose={() => setMessageShare(null)}
        url={messageShare ? chatMessageShareURL(messageShare.id) : chatShareURL()}
        title={
          messageShare
            ? `${messageShare.author.displayName} in chat`
            : "The Strength Lab Chat"
        }
        label="Share this message"
      />
    </div>
  );
}
