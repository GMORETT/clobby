import fs from "fs";
import { readAuth } from "./auth/storage.js";
import { getLogPath, watchLog } from "./daemon/watcher.js";

async function main() {
  const auth = await readAuth();
  if (!auth) {
    process.stderr.write("Clobby daemon: not logged in — run `clobby login`\n");
    process.exit(1);
  }

  const logPath = getLogPath();
  if (!logPath) {
    process.stderr.write("Clobby daemon: unsupported platform\n");
    process.exit(1);
  }

  if (!fs.existsSync(logPath)) {
    process.stderr.write(`Clobby daemon: log not found at ${logPath} — is Claude Desktop installed?\n`);
    process.exit(1);
  }

  process.stdout.write(`Clobby daemon: watching ${logPath}\n`);

  const post = async (endpoint: string) => {
    try {
      await fetch(`${auth.apiUrl}${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.token}` },
      });
    } catch {
      // network error — silent, will retry on next event
    }
  };

  watchLog(logPath, {
    onSessionStart: async () => {
      process.stdout.write(`[${new Date().toISOString()}] → session-start\n`);
      await post("/api/hooks/session-start");
    },
    onStop: async () => {
      process.stdout.write(`[${new Date().toISOString()}] → stop\n`);
      await post("/api/hooks/stop");
    },
  });

  // Keep process alive
  process.stdin.resume();
}

main().catch((err) => {
  process.stderr.write(`Clobby daemon error: ${err}\n`);
  process.exit(1);
});
