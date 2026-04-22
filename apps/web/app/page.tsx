import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center px-4">
      <div className="max-w-xl w-full text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">Clobby</h1>
        <p className="text-xl text-zinc-400">
          The lobby for people waiting on agents.
        </p>
        <p className="text-zinc-500">
          While Claude Code thinks, hang out with other devs doing the same.
        </p>
        <Link
          href="/login"
          className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
        >
          Get started
        </Link>
      </div>
    </main>
  );
}
