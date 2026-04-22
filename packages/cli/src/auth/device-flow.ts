import * as clack from "@clack/prompts";
import open from "open";
import { apiPost } from "../api/client.js";
import { APP_URL, API_URL } from "../config.js";
import { StartResponseSchema, PollResponseSchema } from "@clobby/schemas";
import type { AuthData } from "./storage.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runDeviceFlow(): Promise<AuthData> {
  const startRes = await apiPost<unknown>("/api/auth/cli/start");
  if (!startRes.ok) throw new Error("Failed to start device flow. Is the server reachable?");

  const start = StartResponseSchema.parse(startRes.data);

  console.log(`
Opening browser to authorize this device.

If the browser doesn't open, visit:
  ${start.verification_url_complete}

Verification code: ${start.code}
`);

  try {
    await open(start.verification_url_complete);
  } catch {
    // Headless/SSH — user copies URL manually, that's fine
  }

  const spinner = clack.spinner();
  spinner.start("Waiting for authorization…");

  const deadline = Date.now() + start.expires_in * 1000;

  while (Date.now() < deadline) {
    await sleep(start.interval_seconds * 1000);

    let pollRes: Awaited<ReturnType<typeof apiPost<unknown>>>;
    try {
      pollRes = await apiPost<unknown>("/api/auth/cli/poll", { code: start.code });
    } catch {
      // Network hiccup — retry
      continue;
    }

    if (pollRes.status === 410) {
      spinner.stop("Code already used.");
      throw new Error("This code was already used. Run install again.");
    }

    if (!pollRes.ok && pollRes.status !== 200) continue;

    const result = PollResponseSchema.safeParse(pollRes.data);
    if (!result.success) continue;

    if (result.data.status === "pending") continue;

    // status === "ok"
    spinner.stop("Authorized ✓");

    return {
      version: 1,
      apiUrl: API_URL,
      token: result.data.token,
      userId: result.data.user_id,
      username: result.data.username,
      createdAt: new Date().toISOString(),
    };
  }

  spinner.stop("Authorization timed out.");
  throw new Error("Device code expired. Run `clobby install` again.");
}
