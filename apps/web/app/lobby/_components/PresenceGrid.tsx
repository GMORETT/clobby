"use client";

import { AvatarBubble } from "./AvatarBubble";
import type { PresenceRow } from "../_hooks/useLobbyPresence";

export function PresenceGrid({ rows, myUserId }: { rows: PresenceRow[]; myUserId: string }) {
  if (rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-600 text-sm">No one else is here yet.</p>
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
