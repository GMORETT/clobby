import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LobbyPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("username, avatar_color")
    .eq("id", user.id)
    .single();

  const username = profile?.username ?? user.user_metadata?.user_name ?? "unknown";

  async function logout() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <span className="font-bold text-lg">Clobby</span>
        <div className="flex items-center gap-4">
          <span className="text-zinc-400 text-sm">@{username}</span>
          <form action={logout}>
            <button
              type="submit"
              className="text-zinc-500 hover:text-zinc-200 text-sm transition-colors"
            >
              Logout
            </button>
          </form>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center">
        <h1 className="text-2xl font-semibold text-zinc-300">
          Hello, @{username} 👋
        </h1>
      </div>
    </main>
  );
}
