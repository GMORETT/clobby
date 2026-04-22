import { encryptToken } from "@/lib/auth/device-code";
import { generateCliToken } from "@/lib/auth/cli-token";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ConfirmRequestSchema } from "@clobby/schemas";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ConfirmRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }
  const { code } = parsed.data;

  const { data: deviceCode } = await supabaseAdmin
    .from("device_codes")
    .select("*")
    .eq("code", code)
    .single();

  if (!deviceCode) {
    return NextResponse.json({ error: "Code not found" }, { status: 404 });
  }
  if (new Date(deviceCode.expires_at) < new Date()) {
    return NextResponse.json({ error: "Code expired" }, { status: 410 });
  }
  if (deviceCode.confirmed_at) {
    return NextResponse.json({ error: "Code already confirmed" }, { status: 409 });
  }

  const { plaintext, hash, prefix } = generateCliToken();

  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from("cli_tokens")
    .insert({ user_id: user.id, token_hash: hash, token_prefix: prefix })
    .select("id")
    .single();

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: "Failed to create token" }, { status: 500 });
  }

  const encryptedToken = encryptToken(plaintext, code);

  const { error: updateError } = await supabaseAdmin
    .from("device_codes")
    .update({
      confirmed_at: new Date().toISOString(),
      user_id: user.id,
      cli_token_id: tokenRow.id,
      encrypted_token: encryptedToken,
    })
    .eq("code", code);

  if (updateError) {
    return NextResponse.json({ error: "Failed to confirm code" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
