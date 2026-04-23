"use client";

import { useEffect, useRef } from "react";
import { useLobbyChat } from "../_hooks/useLobbyChat";
import { useChatSound } from "../_hooks/useChatSound";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

interface Props {
  myUserId: string;
}

export function Chat({ myUserId }: Props) {
  const { messages, loading, sending, sendError, clearSendError, sendMessage, loadOlder } = useLobbyChat();
  const { muted, toggleMuted, play } = useChatSound();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const seenIdsRef = useRef<Set<string> | null>(null);

  // Auto-scroll to bottom on new messages if already at bottom
  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Play sound when a new message from someone else arrives.
  // Skip the very first population (initial fetch) and own messages.
  useEffect(() => {
    if (seenIdsRef.current === null) {
      // First population: seed the set without playing sound
      seenIdsRef.current = new Set(messages.map((m) => m.id));
      return;
    }
    const seen = seenIdsRef.current;
    let hasNewFromOthers = false;
    for (const m of messages) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        if (m.user_id !== myUserId) hasNewFromOthers = true;
      }
    }
    if (hasNewFromOthers) void play();
  }, [messages, myUserId, play]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distFromBottom < 80;

    // Load older when scrolled near top
    if (el.scrollTop < 40) {
      loadOlder();
    }
  }

  return (
    <div className="flex flex-col h-full border-l border-zinc-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 shrink-0 flex items-center justify-between">
        <span className="text-zinc-400 text-sm font-mono"># global</span>
        <button
          onClick={toggleMuted}
          className="text-zinc-500 hover:text-zinc-200 transition-colors text-sm"
          aria-label={muted ? "Unmute chat sounds" : "Mute chat sounds"}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? "🔕" : "🔔"}
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-2"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {loading && (
          <p className="text-zinc-600 text-xs text-center py-4">Loading…</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="text-zinc-600 text-xs text-center py-8">
            No messages yet. Say hello!
          </p>
        )}
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            isOwn={msg.user_id === myUserId}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Error banner */}
      {sendError && (
        <div
          className="mx-3 mb-2 px-3 py-2 bg-red-950/40 border border-red-900/60 rounded text-red-300 text-xs flex items-center justify-between gap-2"
          role="alert"
        >
          <span>{sendError}</span>
          <button
            onClick={clearSendError}
            className="text-red-400 hover:text-red-200 transition-colors"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={sending} />
    </div>
  );
}
