"use client";

import type { PresenceRow } from "../_hooks/useLobbyPresence";

function initials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

const STATUS_RING: Record<PresenceRow["status"], string> = {
  working: "ring-yellow-400 animate-pulse",
  needs_input: "ring-red-500 animate-pulse",
  idle: "ring-green-500",
};

const STATUS_LABEL: Record<PresenceRow["status"], string> = {
  working: "working",
  needs_input: "needs input!",
  idle: "idle",
};

export function AvatarBubble({ row, isMe }: { row: PresenceRow; isMe: boolean }) {
  const ringClass = STATUS_RING[row.status];
  const label = STATUS_LABEL[row.status];

  return (
    <div className="flex flex-col items-center gap-2 group">
      <div
        className={`relative w-16 h-16 rounded-full ring-4 ${ringClass} flex items-center justify-center select-none cursor-default`}
        style={{ backgroundColor: row.avatar_color }}
        title={`@${row.username} · ${row.harness} · ${label}`}
      >
        <span className="text-white font-bold text-sm">{initials(row.username)}</span>
        {row.status === "needs_input" && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping" />
        )}
      </div>
      <div className="text-center">
        <p className="text-zinc-200 text-xs font-medium">
          @{row.username}{isMe && " (you)"}
        </p>
        <p className={`text-xs ${row.status === "needs_input" ? "text-red-400" : row.status === "working" ? "text-yellow-400" : "text-green-500"}`}>
          {label}
        </p>
      </div>
    </div>
  );
}
