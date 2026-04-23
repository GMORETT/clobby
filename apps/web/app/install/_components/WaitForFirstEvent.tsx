"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function WaitForFirstEvent({ userId }: { userId: string }) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/presence", { cache: "no-store" });
        if (!res.ok) return;
        const rows = (await res.json()) as Array<{ user_id: string }>;
        if (!cancelled && rows.some((r) => r.user_id === userId)) {
          setConnected(true);
          setTimeout(() => router.replace("/lobby"), 600);
        }
      } catch {
        // swallow network errors; we just retry
      }
    }

    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId, router]);

  if (connected) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-400">
        <span
          className="w-2 h-2 rounded-full bg-green-400"
          style={{ boxShadow: "0 0 8px rgba(74,222,128,0.8)" }}
        />
        Connected! Taking you to the lobby…
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-zinc-500">
      <span className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse" />
      Waiting for your first Claude Code event…
    </div>
  );
}
