"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function AuthCliContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code") ?? "";
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        const next = encodeURIComponent(`/auth/cli?code=${code}`);
        router.replace(`/login?next=${next}`);
      } else {
        setLoggedIn(true);
      }
    });
  }, [code, router]);

  async function handleAuthorize() {
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/cli/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        setStatus("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error ?? "Something went wrong");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (loggedIn === null) {
    return <p className="text-zinc-400 text-sm">Checking session…</p>;
  }

  if (status === "success") {
    return (
      <div className="text-center space-y-3">
        <div className="text-4xl">✓</div>
        <h2 className="text-xl font-semibold text-green-400">Authorized!</h2>
        <p className="text-zinc-400">Return to your terminal to continue.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Authorize CLI access?</h1>
        <p className="text-zinc-400 text-sm">
          A device is requesting access. Only approve if this matches the code in your terminal.
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-6 py-4 text-center">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Verification code</p>
        <p className="text-3xl font-mono font-bold tracking-widest text-zinc-100">{code || "—"}</p>
      </div>

      {status === "error" && (
        <p className="text-red-400 text-sm">{errorMsg}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => router.push("/lobby")}
          className="flex-1 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleAuthorize}
          disabled={status === "loading" || !code}
          className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors text-sm"
        >
          {status === "loading" ? "Authorizing…" : "Authorize"}
        </button>
      </div>
    </div>
  );
}

export default function AuthCliPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <Suspense fallback={<p className="text-zinc-400 text-sm">Loading…</p>}>
          <AuthCliContent />
        </Suspense>
      </div>
    </main>
  );
}
