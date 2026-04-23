import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import * as clack from "@clack/prompts";
import { apiGet, apiPost } from "../api/client.js";
import { runDeviceFlow } from "../auth/device-flow.js";
import { readAuth, writeAuth } from "../auth/storage.js";
import { APP_URL } from "../config.js";
import { HARNESSES } from "../harnesses/registry.js";
import { getLogPath } from "../daemon/watcher.js";
import { registerStartup, isStartupRegistered } from "../daemon/startup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DAEMON_SCRIPT = path.join(__dirname, "daemon.js");

function detectClaudeDesktop(): boolean {
  const logPath = getLogPath();
  if (!logPath) return false;
  // Check if the Claude Desktop data dir exists (not just the log, which may not exist yet)
  const claudeDir = path.dirname(path.dirname(logPath)); // logs/../ = Claude/
  return fs.existsSync(claudeDir);
}

function spawnDaemon(): void {
  if (!fs.existsSync(DAEMON_SCRIPT)) return;
  const child = spawn(process.execPath, [DAEMON_SCRIPT], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

export async function installCommand() {
  clack.intro("Clobby — install");

  // 1. Detect what's available
  const claudeDesktop = detectClaudeDesktop();
  const harnessDetected = await Promise.all(
    HARNESSES.map(async (h) => ({ harness: h, result: await h.detect() }))
  );
  const supportedHarnesses = harnessDetected.filter((d) => d.result.installed);

  if (claudeDesktop) {
    clack.log.success("Claude Desktop detected");
  }
  for (const { harness, result } of harnessDetected) {
    if (result.installed) {
      clack.log.success(`${harness.displayName} (CLI) detected (${result.configPath})`);
    }
  }

  if (!claudeDesktop && supportedHarnesses.length === 0) {
    clack.outro("No supported tools found. Install Claude Desktop or Claude Code first.");
    process.exit(1);
  }

  // 2. Auth check
  let auth = await readAuth();
  if (auth) {
    const check = await apiGet<{ username: string }>("/api/me", auth.token);
    if (!check.ok) {
      clack.log.warn("Existing token is invalid. Re-authenticating…");
      auth = null;
    }
  }
  if (!auth) {
    auth = await runDeviceFlow();
    await writeAuth(auth);
  }
  clack.log.info(`Logged in as @${auth.username}`);

  // 3. Confirm
  const parts: string[] = [];
  if (claudeDesktop) parts.push("Claude Desktop (background daemon)");
  for (const { harness } of supportedHarnesses) parts.push(`${harness.displayName} (hooks)`);

  const proceed = await clack.confirm({
    message: `Install Clobby for: ${parts.join(", ")}?`,
  });
  if (clack.isCancel(proceed) || !proceed) {
    clack.outro("Cancelled.");
    process.exit(0);
  }

  // 4. Claude Desktop: daemon
  if (claudeDesktop) {
    const spinner = clack.spinner();
    spinner.start("Setting up background daemon…");
    try {
      if (!isStartupRegistered()) {
        registerStartup(process.execPath, DAEMON_SCRIPT);
      }
      spawnDaemon();
      spinner.stop("Daemon started and registered for login startup ✓");
    } catch (err) {
      spinner.stop(`Daemon setup failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 5. Claude Code CLI: hooks
  for (const { harness } of supportedHarnesses) {
    const spinner = clack.spinner();
    spinner.start(`Installing hooks for ${harness.displayName}…`);
    try {
      const result = await harness.installHooks({ token: auth.token, apiUrl: auth.apiUrl });
      spinner.stop(`Hooks installed (${result.eventsInstalled.join(", ")}). Backup: ${result.backupPath}`);
    } catch (err) {
      spinner.stop(`Failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  }

  // 6. Test connection
  const spinner = clack.spinner();
  spinner.start("Verifying connection…");
  const test = await apiPost<{ ok: boolean }>("/api/hooks/test", {}, auth.token);
  if (!test.ok) {
    spinner.stop("Connection test failed. Check that the server is reachable.");
    process.exit(1);
  }
  spinner.stop("Connection verified ✓");

  clack.outro(
    `You're in! Open ${APP_URL}/lobby to see the lobby.\nRun \`clobby status\` anytime to check your setup.`
  );
}
