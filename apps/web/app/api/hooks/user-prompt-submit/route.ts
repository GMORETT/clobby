import { verifyCliToken } from "@/lib/auth/verify-cli-token";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const BodySchema = z.object({
  session_id: z.string().optional(),
  source: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const verified = await verifyCliToken(request);
  if (!verified) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  const sessionId = parsed.success ? parsed.data.session_id : undefined;

  const now = new Date().toISOString();
  // Same shape as session-start: flip to "working" and keep upsert semantics
  // so that a UserPromptSubmit after a long idle period still registers.
  await supabaseAdmin.from("presence").upsert({
    user_id: verified.user.id,
    harness: "claude_code",
    status: "working",
    session_id: sessionId ?? null,
    started_at: now,
    last_event_at: now,
  }, { onConflict: "user_id,harness" });

  return new NextResponse(null, { status: 204 });
}
