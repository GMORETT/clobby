"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export interface PresenceRow {
  user_id: string;
  username: string;
  avatar_color: string;
  harness: string;
  status: "working" | "needs_input" | "idle";
  last_event_at: string;
}

const STATUS_ORDER = { needs_input: 0, working: 1, idle: 2 };

function sort(rows: PresenceRow[]): PresenceRow[] {
  return [...rows].sort((a, b) => {
    const so = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (so !== 0) return so;
    return new Date(b.last_event_at).getTime() - new Date(a.last_event_at).getTime();
  });
}

function applyChange(prev: PresenceRow[], payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }): PresenceRow[] {
  if (payload.eventType === "DELETE") {
    return prev.filter((r) => r.user_id !== (payload.old.user_id as string));
  }

  const incoming = payload.new as unknown as PresenceRow;
  const existing = prev.findIndex((r) => r.user_id === incoming.user_id && r.harness === incoming.harness);

  // Merge username/avatar from existing row if missing in realtime payload
  const merged: PresenceRow = {
    ...incoming,
    username: existing >= 0 ? prev[existing].username : (incoming.username ?? ""),
    avatar_color: existing >= 0 ? prev[existing].avatar_color : (incoming.avatar_color ?? "#6366f1"),
  };

  if (existing >= 0) {
    const next = [...prev];
    next[existing] = merged;
    return next;
  }
  return [...prev, merged];
}

async function fetchPresence(): Promise<PresenceRow[]> {
  const res = await fetch("/api/presence");
  return res.json();
}

export function useLobbyPresence() {
  const [presence, setPresence] = useState<PresenceRow[]>([]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function setup() {
      setPresence(sort(await fetchPresence()));

      const { data: { session } } = await supabase.auth.getSession();
      if (session) supabase.realtime.setAuth(session.access_token);

      // Realtime catches INSERTs instantly; polling catches missed UPDATEs
      channel = supabase
        .channel("lobby-presence")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "presence" },
          (payload) => {
            setPresence((prev) =>
              sort(applyChange(prev, payload as Parameters<typeof applyChange>[1]))
            );
          }
        )
        .subscribe();
    }

    setup();

    // Fallback poll every 3s to catch UPDATE events Realtime may miss
    const poll = setInterval(async () => {
      setPresence(sort(await fetchPresence()));
    }, 3000);

    return () => {
      clearInterval(poll);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return presence;
}
