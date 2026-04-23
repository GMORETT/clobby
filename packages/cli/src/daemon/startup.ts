import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

function getStartupBatPath(): string {
  // Windows: user startup folder (no admin needed)
  return path.join(
    process.env.APPDATA!,
    "Microsoft",
    "Windows",
    "Start Menu",
    "Programs",
    "Startup",
    "clobby-daemon.bat"
  );
}

function getLaunchAgentPath(): string {
  return path.join(os.homedir(), "Library", "LaunchAgents", "app.clobby.daemon.plist");
}

export function registerStartup(nodePath: string, daemonScriptPath: string): void {
  if (process.platform === "win32") {
    const content = [
      "@echo off",
      `start "" /B "${nodePath}" "${daemonScriptPath}"`,
      "",
    ].join("\r\n");
    fs.writeFileSync(getStartupBatPath(), content);
  } else if (process.platform === "darwin") {
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>app.clobby.daemon</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${daemonScriptPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${os.homedir()}/.clobby/daemon.log</string>
  <key>StandardErrorPath</key>
  <string>${os.homedir()}/.clobby/daemon.log</string>
</dict>
</plist>`;
    const plistPath = getLaunchAgentPath();
    fs.mkdirSync(path.dirname(plistPath), { recursive: true });
    fs.writeFileSync(plistPath, plist);
    try { execSync(`launchctl load "${plistPath}"`); } catch { /* may already be loaded */ }
  }
}

export function unregisterStartup(): void {
  if (process.platform === "win32") {
    const p = getStartupBatPath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } else if (process.platform === "darwin") {
    const p = getLaunchAgentPath();
    if (fs.existsSync(p)) {
      try { execSync(`launchctl unload "${p}"`); } catch { /* ignore */ }
      fs.unlinkSync(p);
    }
  }
}

export function isStartupRegistered(): boolean {
  if (process.platform === "win32") return fs.existsSync(getStartupBatPath());
  if (process.platform === "darwin") return fs.existsSync(getLaunchAgentPath());
  return false;
}
