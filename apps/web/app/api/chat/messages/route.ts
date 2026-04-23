import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// 1 msg/sec burst, 10 msgs/10s sustained, 60 msgs/min sustained
const CHAT_RATE_LIMIT = [
  { windowMs: 1_000, max: 1 },
  { windowMs: 10_000, max: 10 },
  { windowMs: 60_000, max: 60 },
];

const PostSchema = z.object({
  content: z.string().min(1).max(500),
});

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);
  const before = searchParams.get("before");

  let query = supabaseAdmin
    .from("chat_messages")
    .select("id, content, created_at, user_id, users(username, avatar_color)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return in ascending order for display
  return NextResponse.json((data ?? []).reverse());
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const content = parsed.data.content.trim();
  if (content.length === 0) {
    return NextResponse.json({ error: "Content cannot be empty" }, { status: 400 });
  }

  // Rate limit by user id
  const rl = checkRateLimit(`chat:${user.id}`, CHAT_RATE_LIMIT);
  if (!rl.allowed) {
    const retryAfterSec = Math.ceil(rl.retryAfterMs / 1000);
    return NextResponse.json(
      { error: "Slow down — too many messages.", retryAfterMs: rl.retryAfterMs },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("chat_messages")
    .insert({ user_id: user.id, content })
    .select("id, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
