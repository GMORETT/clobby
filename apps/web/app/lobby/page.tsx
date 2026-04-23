import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LobbyClient } from "./_components/LobbyClient";

export default async function LobbyPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Gate: lobby access requires at least one presence event ever.
  // Prevents drive-by GitHub signins from filling the lobby with ghost users
  // who never actually installed the CLI.
  const { count: presenceCount } = await supabase
    .from("presence")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (!presenceCount) redirect("/install");

  const { data: profile } = await supabase
    .from("users")
    .select("id, username, avatar_color")
    .eq("id", user.id)
    .single();

  const username = profile?.username ?? user.user_metadata?.user_name ?? "unknown";

  return (
    <LobbyClient
      userId={profile?.id ?? user.id}
      username={username}
      avatarColor={profile?.avatar_color ?? "#6366f1"}
    />
  );
}
