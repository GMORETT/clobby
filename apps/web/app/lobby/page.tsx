import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LobbyClient } from "./_components/LobbyClient";

export default async function LobbyPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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
