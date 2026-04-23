import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";

export function getLogPath(): string | null {
  if (process.platform === "win32") {
    const appdata = process.env.APPDATA;
    if (!appdata) return null;
    return path.join(appdata, "Claude", "logs", "main.log");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Logs", "Claude", "main.log");
  }
  return null;
}

export interface WatcherCallbacks {
  onSessionStart: () => Promise<void>;
  onStop: () => Promise<void>;
}

export function watchLog(logPath: string, callbacks: WatcherCallbacks): void {
  // Start from end of file so we don't replay old events
  let position = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;
  let busy = false;

  async function readNewLines() {
    if (busy) return;
    busy = true;
    try {
      const stat = fs.statSync(logPath);
      if (stat.size < position) position = 0; // file rotated
      if (stat.size <= position) return;

      const stream = fs.createReadStream(logPath, {
        start: position,
        end: stat.size - 1,
        encoding: "utf8",
      });
      position = stat.size;

      await new Promise<void>((resolve) => {
        const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
        rl.on("line", (line) => {
          if (line.includes("LocalSessions.sendMessage")) {
            callbacks.onSessionStart().catch(() => {});
          } else if (line.includes("[Stop hook] Query completed")) {
            callbacks.onStop().catch(() => {});
          }
        });
        rl.on("close", resolve);
      });
    } catch {
      // ignore read errors, will retry on next change
    } finally {
      busy = false;
    }
  }

  // fs.watch for near-instant detection
  try {
    fs.watch(logPath, () => { readNewLines(); });
  } catch {
    // fall through to polling
  }

  // polling fallback every 2s (handles network drives, WSL, etc.)
  setInterval(() => { readNewLines(); }, 2000);
}
