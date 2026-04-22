import { hashToken } from "./cli-token";
import { supabaseAdmin } from "../supabase/admin";

export interface VerifiedToken {
  user: { id: string; username: string; avatar_color: string };
  tokenId: string;
}

export async function verifyCliToken(req: Request): Promise<VerifiedToken | null> {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const plaintext = header.slice(7);
  const hash = hashToken(plaintext);

  const { data } = await supabaseAdmin
    .from("cli_tokens")
    .select("id, revoked_at, users(id, username, avatar_color)")
    .eq("token_hash", hash)
    .single();

  if (!data || data.revoked_at) return null;

  // fire-and-forget
  supabaseAdmin
    .from("cli_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  const user = data.users as unknown as { id: string; username: string; avatar_color: string };
  return { user, tokenId: data.id };
}
