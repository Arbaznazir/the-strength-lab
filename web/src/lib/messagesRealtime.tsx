"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getToken, messagesWsUrl } from "./api";
import { useAuth } from "./auth";
import type { PrivateMessage } from "./types";

export type DmWsPayload = {
  type: "dm";
  conversationId: string;
  message: PrivateMessage;
};

export type TypingWsPayload = {
  type: "typing";
  conversationId: string;
  userId: string;
  username: string;
  active: boolean;
};

type MessagesRealtimeContextValue = {
  connected: boolean;
  subscribe: (fn: (payload: DmWsPayload) => void) => () => void;
  subscribeTyping: (fn: (payload: TypingWsPayload) => void) => () => void;
  sendTyping: (conversationId: string, active: boolean) => void;
};

const MessagesRealtimeContext =
  createContext<MessagesRealtimeContextValue | null>(null);

export function MessagesRealtimeProvider({ children }: { children: ReactNode }) {
  const { user, refresh } = useAuth();
  const dmSubsRef = useRef(new Set<(payload: DmWsPayload) => void>());
  const typingSubsRef = useRef(new Set<(payload: TypingWsPayload) => void>());
  const refreshRef = useRef(refresh);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  refreshRef.current = refresh;

  useEffect(() => {
    if (!user?.id) {
      setConnected(false);
      wsRef.current = null;
      return;
    }

    const token = getToken();
    if (!token) return;

    let ws: WebSocket | null = null;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (closed) return;
      void messagesWsUrl(token!)
        .then((url) => {
          if (closed) return;
          ws = new WebSocket(url);
          wsRef.current = ws;

          ws.onopen = () => {
            if (!closed) setConnected(true);
          };

          ws.onclose = () => {
            setConnected(false);
            wsRef.current = null;
            if (!closed) {
              retryTimer = setTimeout(connect, 3000);
            }
          };

          ws.onmessage = (ev) => {
            try {
              const data = JSON.parse(ev.data as string) as {
                type?: string;
              };
              if (data.type === "dm") {
                const payload = data as DmWsPayload;
                if (!payload.conversationId || !payload.message) return;
                void refreshRef.current();
                dmSubsRef.current.forEach((fn) => fn(payload));
                return;
              }
              if (data.type === "typing") {
                const payload = data as TypingWsPayload;
                if (!payload.conversationId || !payload.userId) return;
                typingSubsRef.current.forEach((fn) => fn(payload));
              }
            } catch {
              /* ignore malformed payloads */
            }
          };
        })
        .catch(() => {
          if (!closed) retryTimer = setTimeout(connect, 3000);
        });
    }

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [user?.id]);

  const subscribe = useCallback((fn: (payload: DmWsPayload) => void) => {
    dmSubsRef.current.add(fn);
    return () => {
      dmSubsRef.current.delete(fn);
    };
  }, []);

  const subscribeTyping = useCallback(
    (fn: (payload: TypingWsPayload) => void) => {
      typingSubsRef.current.add(fn);
      return () => {
        typingSubsRef.current.delete(fn);
      };
    },
    [],
  );

  const sendTyping = useCallback((conversationId: string, active: boolean) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !conversationId) return;
    ws.send(
      JSON.stringify({
        type: "typing",
        conversationId,
        active,
      }),
    );
  }, []);

  const value = useMemo(
    () => ({ connected, subscribe, subscribeTyping, sendTyping }),
    [connected, subscribe, subscribeTyping, sendTyping],
  );

  return (
    <MessagesRealtimeContext.Provider value={value}>
      {children}
    </MessagesRealtimeContext.Provider>
  );
}

export function useMessagesRealtime() {
  const ctx = useContext(MessagesRealtimeContext);
  if (!ctx) {
    throw new Error(
      "useMessagesRealtime must be used within MessagesRealtimeProvider",
    );
  }
  return ctx;
}

export function useDmSubscription(handler: (payload: DmWsPayload) => void) {
  const { subscribe } = useMessagesRealtime();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(
    () =>
      subscribe((payload) => {
        handlerRef.current(payload);
      }),
    [subscribe],
  );
}

export function useTypingSubscription(
  handler: (payload: TypingWsPayload) => void,
) {
  const { subscribeTyping } = useMessagesRealtime();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(
    () =>
      subscribeTyping((payload) => {
        handlerRef.current(payload);
      }),
    [subscribeTyping],
  );
}

const TYPING_STOP_MS = 3000;
const TYPING_RESEND_MS = 2000;

export function useTypingEmitter(conversationId: string, text: string) {
  const { sendTyping } = useMessagesRealtime();
  const isTypingRef = useRef(false);
  const lastSentRef = useRef(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (isTypingRef.current) {
      sendTyping(conversationId, false);
      isTypingRef.current = false;
    }
  }, [conversationId, sendTyping]);

  useEffect(() => {
    if (!conversationId) return;

    const trimmed = text.trim();
    if (!trimmed) {
      stop();
      return;
    }

    const now = Date.now();
    if (!isTypingRef.current || now - lastSentRef.current >= TYPING_RESEND_MS) {
      sendTyping(conversationId, true);
      isTypingRef.current = true;
      lastSentRef.current = now;
    }

    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(stop, TYPING_STOP_MS);

    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    };
  }, [conversationId, text, sendTyping, stop]);

  useEffect(() => stop, [stop]);

  return stop;
}
