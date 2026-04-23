import { homedir } from "os";
import { join } from "path";
import { platform } from "process";

export function getClaudeConfigDir(): string {
  // Claude Code stores global settings in ~/.claude/
  return join(homedir(), ".claude");
}

export function getClaudeSettingsPath(): string {
  return join(getClaudeConfigDir(), "settings.json");
}

export function getClobbyConfigDir(): string {
  if (process.env.CLOBBY_CONFIG_DIR) return process.env.CLOBBY_CONFIG_DIR;
  if (platform === "win32") {
    return join(process.env.APPDATA ?? homedir(), "clobby");
  }
  return join(homedir(), ".config", "clobby");
}
