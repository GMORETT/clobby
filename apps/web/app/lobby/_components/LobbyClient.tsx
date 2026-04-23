"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useLobbyPresence } from "../_hooks/useLobbyPresence";
import { PresenceGrid } from "./PresenceGrid";
import { Chat } from "./Chat";

interface Props {
  userId: string;
  username: string;
  avatarColor: string;
}

export function LobbyClient({ userId, username, avatarColor }: Props) {
  const { presence, loading: presenceLoading } = useLobbyPresence();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <main className="h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 shrink-0">
        <span className="font-bold text-lg tracking-tight">Clobby</span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: avatarColor }}
            >
              {username.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-zinc-400 text-sm">@{username}</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-zinc-500 hover:text-zinc-200 text-sm transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Presence panel */}
        <div className="flex-1 overflow-y-auto">
          <PresenceGrid rows={presence} myUserId={userId} loading={presenceLoading} />
        </div>

        {/* Chat panel */}
        <div className="w-80 shrink-0 flex flex-col overflow-hidden">
          <Chat myUserId={userId} />
        </div>
      </div>
    </main>
  );
}
