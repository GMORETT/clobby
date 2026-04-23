#!/usr/bin/env node
import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { installCommand } from "./commands/install.js";
import { uninstallCommand } from "./commands/uninstall.js";
import { statusCommand } from "./commands/status.js";
import { logoutCommand } from "./commands/logout.js";

const program = new Command();

program
  .name("clobby")
  .description("Connect your agentic coding tools to the Clobby lobby.")
  .version("0.0.1");

function wrap(fn: () => Promise<void>) {
  return async () => {
    try {
      await fn();
    } catch (err) {
      console.error(`\nError: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  };
}

program
  .command("login")
  .description("Authenticate this machine with your Clobby account")
  .action(wrap(loginCommand));

program
  .command("install")
  .description("Install Clobby hooks into your agentic coding tools")
  .action(wrap(installCommand));

program
  .command("uninstall")
  .description("Remove Clobby hooks from your agentic coding tools")
  .action(wrap(uninstallCommand));

program
  .command("status")
  .description("Show current Clobby status and installed hooks")
  .action(wrap(statusCommand));

program
  .command("logout")
  .description("Clear saved credentials from this machine")
  .action(wrap(logoutCommand));

program
  .command("daemon")
  .description("Run the background log-watcher daemon (usually started by install)")
  .action(wrap(async () => {
    // daemon.ts is a standalone entry point — just tell user to run it directly
    const { fileURLToPath } = await import("url");
    const path = await import("path");
    const { spawn } = await import("child_process");
    const __dirname = path.default.dirname(fileURLToPath(import.meta.url));
    const daemonScript = path.default.join(__dirname, "daemon.js");
    const child = spawn(process.execPath, [daemonScript], { stdio: "inherit" });
    await new Promise<void>((_, reject) => child.on("error", reject));
  }));

program.parse();
