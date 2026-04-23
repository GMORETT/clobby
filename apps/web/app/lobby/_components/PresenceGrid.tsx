"use client";

import { AvatarBubble } from "./AvatarBubble";
import type { PresenceRow } from "../_hooks/useLobbyPresence";

export function PresenceGrid({
  rows,
  myUserId,
  loading,
}: {
  rows: PresenceRow[];
  myUserId: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-600 text-sm">Loading lobby…</p>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-sm space-y-2">
          <p className="text-zinc-400 text-sm">No one else is here yet.</p>
          <p className="text-zinc-600 text-xs">
            Run <code className="text-indigo-400">npm i -g @gmorett/clobby && clobby install</code> on another machine
            and kick off an agent to see your dot show up.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="grid gap-8" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))" }}>
        {rows.map((row) => (
          <AvatarBubble key={`${row.user_id}-${row.harness}`} row={row} isMe={row.user_id === myUserId} />
        ))}
      </div>
      <p className="text-zinc-600 text-xs mt-6">{rows.length} dev{rows.length !== 1 ? "s" : ""} online</p>
    </div>
  );
}
