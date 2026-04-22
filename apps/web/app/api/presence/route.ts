import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data } = await supabaseAdmin
    .from("presence")
    .select("user_id, harness, status, last_event_at, users(username, avatar_color)")
    .gt("last_event_at", cutoff);

  const rows = (data ?? []).map((row) => {
    const u = row.users as unknown as { username: string; avatar_color: string };
    return {
      user_id: row.user_id,
      username: u.username,
      avatar_color: u.avatar_color,
      harness: row.harness,
      status: row.status,
      last_event_at: row.last_event_at,
    };
  });

  return NextResponse.json(rows);
}
