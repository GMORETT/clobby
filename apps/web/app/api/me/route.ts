import { hashToken } from "@/lib/auth/cli-token";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Try bearer token first
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const plaintext = authHeader.slice(7);
    const hash = hashToken(plaintext);

    const { data } = await supabaseAdmin
      .from("cli_tokens")
      .select("id, revoked_at, users(id, username, avatar_color)")
      .eq("token_hash", hash)
      .single();

    if (!data || data.revoked_at) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Fire-and-forget last_used_at update
    supabaseAdmin
      .from("cli_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);

    const user = data.users as unknown as { id: string; username: string; avatar_color: string } | null;
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({ id: user.id, username: user.username, avatar_color: user.avatar_color });
  }

  // Fall back to web session
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("id, username, avatar_color")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  return NextResponse.json({ id: profile.id, username: profile.username, avatar_color: profile.avatar_color });
}
