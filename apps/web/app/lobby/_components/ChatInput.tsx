"use client";

import { useState, useRef, KeyboardEvent } from "react";
import type { SendResult } from "../_hooks/useLobbyChat";

interface Props {
  onSend: (content: string) => Promise<SendResult>;
  disabled?: boolean;
}

const MAX_CHARS = 500;
const WARN_THRESHOLD = 450;

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const remaining = MAX_CHARS - value.length;
  const showCounter = value.length >= WARN_THRESHOLD;
  const isOverLimit = value.length > MAX_CHARS;

  async function submit() {
    if (!value.trim() || isOverLimit || submitting || disabled) return;
    setSubmitting(true);
    const result = await onSend(value);
    setSubmitting(false);
    if (result.ok) {
      setValue("");
    }
    // Always refocus so Enter-spam works even after rate-limit errors
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-zinc-800 p-3">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message the lobby... (Enter to send, Shift+Enter for new line)"
          rows={1}
          disabled={disabled || submitting}
          className="w-full bg-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-zinc-600 disabled:opacity-50 min-h-[40px] max-h-32 overflow-y-auto"
          style={{ fieldSizing: "content" } as React.CSSProperties}
        />
        {showCounter && (
          <span
            className={`absolute bottom-2 right-2 text-[10px] tabular-nums ${
              isOverLimit ? "text-red-400" : "text-zinc-500"
            }`}
          >
            {remaining}
          </span>
        )}
      </div>
    </div>
  );
}
