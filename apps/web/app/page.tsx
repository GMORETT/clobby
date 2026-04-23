import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/lobby");

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-900">
        <span className="font-bold text-lg tracking-tight">Clobby</span>
        <Link
          href="/login"
          className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="max-w-2xl space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
            The lobby for people<br />waiting on agents.
          </h1>
          <p className="text-xl text-zinc-400 max-w-lg mx-auto">
            While your AI codes, hang out with other devs doing the same.
            See who&rsquo;s heads-down, who&rsquo;s stuck, who&rsquo;s idle.
          </p>
          <div className="pt-4 flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
            >
              Sign in with GitHub
            </Link>
          </div>
          <p className="text-sm text-zinc-500 pt-2">
            Free while in beta. No credit card.
          </p>
        </div>

        {/* Preview card */}
        <div className="mt-16 w-full max-w-md bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 shadow-2xl">
          <div className="text-xs text-zinc-500 font-mono mb-4 text-left">
            clobby.vercel.app / lobby
          </div>
          <ul className="space-y-3 text-left">
            <PresenceRow name="alice" color="#ef4444" status="needs_input" />
            <PresenceRow name="bob" color="#22c55e" status="working" />
            <PresenceRow name="charlie" color="#f59e0b" status="working" />
            <PresenceRow name="dina" color="#8b5cf6" status="idle" />
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-zinc-900 px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-12">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Step
              num="1"
              title="Install the CLI"
              body={
                <>
                  One command:{" "}
                  <code className="text-indigo-400 text-sm">npx @gmorett/clobby install</code>
                </>
              }
            />
            <Step
              num="2"
              title="Code like you always do"
              body="No copy-paste, no manual check-in. A tiny daemon watches your agent logs in the background."
            />
            <Step
              num="3"
              title="Your dot tells the story"
              body="Green while the agent is working, red when it stops and needs you, grey when you&rsquo;re idle."
            />
          </div>
        </div>
      </section>

      {/* Works with */}
      <section className="border-t border-zinc-900 px-6 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm uppercase tracking-widest text-zinc-500 mb-6">
            Works with
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-zinc-300">
            <span>Claude Desktop</span>
            <span>Claude Code</span>
            <span className="text-zinc-600">Cursor &middot; soon</span>
            <span className="text-zinc-600">Codex &middot; soon</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 px-6 py-8 text-center text-sm text-zinc-600">
        <div className="flex items-center justify-center gap-6">
          <a
            href="https://github.com/clobby"
            className="hover:text-zinc-300 transition-colors"
            target="_blank"
            rel="noreferrer noopener"
          >
            GitHub
          </a>
          <Link href="/login" className="hover:text-zinc-300 transition-colors">
            Sign in
          </Link>
        </div>
        <p className="mt-4">Built for devs who hate staring at a progress bar alone.</p>
      </footer>
    </main>
  );
}

function PresenceRow({
  name,
  color,
  status,
}: {
  name: string;
  color: string;
  status: "working" | "needs_input" | "idle";
}) {
  const dot =
    status === "working"
      ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
      : status === "needs_input"
      ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse"
      : "bg-zinc-600";
  const label =
    status === "working"
      ? "coding"
      : status === "needs_input"
      ? "needs input"
      : "idle";
  return (
    <li className="flex items-center gap-3">
      <span className="relative flex items-center justify-center">
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {name.slice(0, 2).toUpperCase()}
        </span>
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900 ${dot}`}
        />
      </span>
      <span className="text-sm text-zinc-200">@{name}</span>
      <span className="ml-auto text-xs text-zinc-500">{label}</span>
    </li>
  );
}

function Step({
  num,
  title,
  body,
}: {
  num: string;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div>
      <div className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center text-sm font-semibold mb-4">
        {num}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-zinc-400 leading-relaxed">{body}</p>
    </div>
  );
}
