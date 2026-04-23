"use client";

import { useEffect, useRef, useState, useCallback } from "react";
// useRef kept for channelRef
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface ChatMessage {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  users: {
    username: string;
    avatar_color: string;
  };
}

export interface SendResult {
  ok: boolean;
  error?: string;
  retryAfterMs?: number;
}

export function useLobbyChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createSupabaseBrowserClient>["channel"]> | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function fetchLatest(after?: string): Promise<ChatMessage[]> {
      const url = after
        ? `/api/chat/messages?limit=20&before=${encodeURIComponent(new Date().toISOString())}&after=${encodeURIComponent(after)}`
        : "/api/chat/messages?limit=50";
      return fetch(url).then((r) => r.json()).catch(() => []);
    }

    async function setup() {
      // Initial fetch
      try {
        const data = await fetchLatest();
        setMessages(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }

      // Set JWT before subscribing
      const { data: { session } } = await supabase.auth.getSession();
      if (session) supabase.realtime.setAuth(session.access_token);

      // Realtime (best effort — fires instantly when it works)
      channel = supabase
        .channel("lobby-chat")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages" },
          async () => {
            const latest: ChatMessage[] = await fetch("/api/chat/messages?limit=5")
              .then((r) => r.json())
              .catch(() => []);
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              const newOnes = latest.filter((m) => !existingIds.has(m.id));
              if (newOnes.length === 0) return prev;
              return [...prev, ...newOnes];
            });
          }
        )
        .subscribe();

      channelRef.current = channel;
    }

    setup();

    // Polling safety net every 10s — Realtime handles instant delivery,
    // this catches the rare case where the WebSocket drops/reconnects
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/chat/messages?limit=10");
        if (!res.ok) return;
        const latest: ChatMessage[] = await res.json();
        if (!Array.isArray(latest)) return;
        setMessages((curr) => {
          const existingIds = new Set(curr.map((m) => m.id));
          const newOnes = latest.filter((m) => !existingIds.has(m.id));
          if (newOnes.length === 0) return curr;
          return [...curr, ...newOnes];
        });
      } catch {
        // ignore
      }
    }, 10000);

    return () => {
      clearInterval(poll);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const sendMessage = useCallback(async (content: string): Promise<SendResult> => {
    const trimmed = content.trim();
    if (!trimmed) return { ok: false, error: "Message is empty." };
    if (trimmed.length > 500) return { ok: false, error: "Message too long (max 500)." };
    if (sending) return { ok: false, error: "Already sending." };

    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (res.ok) return { ok: true };

      // Parse error
      const payload = await res.json().catch(() => ({}));
      let errMsg: string;
      if (res.status === 429) {
        errMsg = payload.error ?? "Slow down.";
      } else if (res.status === 401) {
        errMsg = "Session expired. Refresh the page.";
      } else if (res.status === 400) {
        errMsg = typeof payload.error === "string" ? payload.error : "Invalid message.";
      } else {
        errMsg = "Failed to send. Try again.";
      }
      setSendError(errMsg);
      return { ok: false, error: errMsg, retryAfterMs: payload.retryAfterMs };
    } catch {
      const errMsg = "Network error. Check your connection.";
      setSendError(errMsg);
      return { ok: false, error: errMsg };
    } finally {
      setSending(false);
    }
  }, [sending]);

  const clearSendError = useCallback(() => setSendError(null), []);

  const loadingOlderRef = useRef(false);
  const noMoreOlderRef = useRef(false);
  const loadOlder = useCallback(async () => {
    if (messages.length === 0) return;
    if (loadingOlderRef.current || noMoreOlderRef.current) return;
    loadingOlderRef.current = true;
    try {
      const oldest = messages[0];
      const res = await fetch(
        `/api/chat/messages?limit=50&before=${encodeURIComponent(oldest.created_at)}`,
      );
      if (!res.ok) return;
      const older = (await res.json()) as ChatMessage[];
      if (!Array.isArray(older) || older.length === 0) {
        noMoreOlderRef.current = true;
        return;
      }
      setMessages((prev) => {
        const existing = new Set(prev.map((m) => m.id));
        const deduped = older.filter((m) => !existing.has(m.id));
        if (deduped.length === 0) {
          noMoreOlderRef.current = true;
          return prev;
        }
        return [...deduped, ...prev];
      });
    } finally {
      loadingOlderRef.current = false;
    }
  }, [messages]);

  return { messages, loading, sending, sendError, clearSendError, sendMessage, loadOlder };
}
