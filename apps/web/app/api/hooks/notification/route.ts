import { verifyCliToken } from "@/lib/auth/verify-cli-token";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const verified = await verifyCliToken(request);
  if (!verified) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabaseAdmin.from("presence").update({
    status: "needs_input",
    last_event_at: new Date().toISOString(),
  }).eq("user_id", verified.user.id).eq("harness", "claude_code");

  return new NextResponse(null, { status: 204 });
}
