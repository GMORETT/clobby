import { apiGet } from "../api/client.js";
import { readAuth } from "../auth/storage.js";
import { HARNESSES } from "../harnesses/registry.js";
import { isStartupRegistered } from "../daemon/startup.js";
import { getLogPath } from "../daemon/watcher.js";
import fs from "fs";

export async function statusCommand() {
  console.log("Clobby CLI v0.0.1\n");

  const auth = await readAuth();
  const apiUrl = auth?.apiUrl ?? "https://clobby.app";

  if (!auth) {
    console.log("Account\n  not logged in (run `clobby login`)\n");
  } else {
    const check = await apiGet<{ username: string }>("/api/me", auth.token);
    if (check.ok) {
      console.log(`Account\n  logged in as @${check.data.username}\n`);
    } else {
      console.log("Account\n  token invalid (run `clobby login`)\n");
    }
  }

  // Daemon status
  const logPath = getLogPath();
  const claudeDir = logPath ? logPath.replace(/[/\\]logs[/\\]main\.log$/, "") : null;
  console.log("Claude Desktop");
  if (isStartupRegistered()) {
    console.log("  ✓ daemon registered for startup");
  } else if (claudeDir && fs.existsSync(claudeDir)) {
    console.log("  ○ detected but daemon not installed (run `clobby install`)");
  } else {
    console.log("  ✗ not detected");
  }

  // Claude Code CLI hooks
  console.log("\nClaude Code CLI");
  for (const harness of HARNESSES) {
    const hooks = await harness.listInstalledHooks(apiUrl);
    if (hooks.length > 0) {
      console.log(`  ✓ hooks installed (${hooks.length} events)`);
    } else {
      const detected = await harness.detect();
      if (detected.installed) {
        console.log(`  ○ detected but hooks not installed`);
      } else {
        console.log(`  ✗ not detected`);
      }
    }
  }
}
