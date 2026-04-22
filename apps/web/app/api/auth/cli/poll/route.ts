import { decryptToken } from "@/lib/auth/device-code";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PollRequestSchema } from "@clobby/schemas";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = PollRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { code } = parsed.data;

  const { data: deviceCode } = await supabaseAdmin
    .from("device_codes")
    .select("*, users(username)")
    .eq("code", code)
    .single();

  if (!deviceCode || new Date(deviceCode.expires_at) < new Date()) {
    return NextResponse.json({ error: "Code not found or expired" }, { status: 404 });
  }

  if (deviceCode.consumed_at) {
    return NextResponse.json({ error: "Code already used" }, { status: 410 });
  }

  if (!deviceCode.confirmed_at) {
    return NextResponse.json({ status: "pending" });
  }

  // Confirmed but not consumed — decrypt and return token
  let plaintext: string;
  try {
    plaintext = decryptToken(deviceCode.encrypted_token, code);
  } catch {
    return NextResponse.json({ error: "Failed to decrypt token" }, { status: 500 });
  }

  await supabaseAdmin
    .from("device_codes")
    .update({ consumed_at: new Date().toISOString(), encrypted_token: null })
    .eq("code", code);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://clobby.app";
  const username = (deviceCode.users as { username: string } | null)?.username ?? "";

  return NextResponse.json({
    status: "ok",
    token: plaintext,
    user_id: deviceCode.user_id,
    username,
    api_url: appUrl,
  });
}
