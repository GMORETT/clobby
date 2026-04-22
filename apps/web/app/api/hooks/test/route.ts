import { verifyCliToken } from "@/lib/auth/verify-cli-token";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const verified = await verifyCliToken(request);
  if (!verified) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ ok: true, user: { id: verified.user.id, username: verified.user.username } });
}
