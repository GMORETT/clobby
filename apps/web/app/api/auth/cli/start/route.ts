import { generateDeviceCode } from "@/lib/auth/device-code";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST() {
  const code = generateDeviceCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://clobby.app";

  const { error } = await supabaseAdmin
    .from("device_codes")
    .insert({ code, expires_at: expiresAt });

  if (error) {
    return NextResponse.json({ error: "Failed to create device code" }, { status: 500 });
  }

  return NextResponse.json({
    code,
    verification_url: `${appUrl}/auth/cli`,
    verification_url_complete: `${appUrl}/auth/cli?code=${code}`,
    poll_url: `${appUrl}/api/auth/cli/poll`,
    interval_seconds: 2,
    expires_in: 900,
  });
}
