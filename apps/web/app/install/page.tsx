import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function InstallPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/install");

  const username = user.user_metadata?.user_name ?? "there";

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Hey, @{username}!</h1>
          <p className="text-zinc-400">Install the CLI to connect Claude Code to Clobby.</p>
        </div>

        <ol className="space-y-6">
          <li className="space-y-2">
            <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Step 1</span>
            <p className="text-zinc-200">Run this command in your terminal:</p>
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 font-mono text-sm">
              <span className="text-zinc-500 select-none">$</span>
              <span className="flex-1 text-zinc-100">npx @clobby/cli install</span>
            </div>
          </li>
          <li>
            <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Step 2</span>
            <p className="text-zinc-200 mt-1">A browser window will open to authorize the CLI.</p>
          </li>
          <li>
            <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Step 3</span>
            <p className="text-zinc-200 mt-1">You&apos;re in! Start Claude Code and watch your status update live.</p>
          </li>
        </ol>

        <Link
          href="/lobby"
          className="inline-block text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
        >
          I&apos;ve installed it, take me to the lobby →
        </Link>
      </div>
    </main>
  );
}
