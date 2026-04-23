import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { getClaudeConfigDir, getClaudeSettingsPath } from "../utils/paths.js";
import {
  ClaudeSettings,
  installHooksIntoSettings,
  listClobbyHooks,
  removeHooksFromSettings,
} from "../utils/json-merge.js";
import type {
  DetectResult,
  Harness,
  InstalledHook,
  InstallParams,
  InstallResult,
  RemoveResult,
} from "./types.js";
import { API_URL } from "../config.js";

async function readSettings(): Promise<ClaudeSettings> {
  const path = getClaudeSettingsPath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(await readFile(path, "utf8")) as ClaudeSettings;
  } catch {
    return {};
  }
}

async function writeSettings(settings: ClaudeSettings): Promise<void> {
  const path = getClaudeSettingsPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(settings, null, 2), "utf8");
}

async function backupSettings(): Promise<string> {
  const path = getClaudeSettingsPath();
  const backupPath = `${path}.clobby-backup.${Date.now()}`;
  if (existsSync(path)) {
    const content = await readFile(path, "utf8");
    await writeFile(backupPath, content, "utf8");
  }
  return backupPath;
}

export const claudeCodeHarness: Harness = {
  id: "claude_code",
  displayName: "Claude Code",

  async detect(): Promise<DetectResult> {
    const configDir = getClaudeConfigDir();
    const installed = existsSync(configDir);
    return {
      installed,
      configPath: installed ? getClaudeSettingsPath() : null,
    };
  },

  async isInstalled(): Promise<boolean> {
    return existsSync(getClaudeConfigDir());
  },

  async installHooks({ token, apiUrl }: InstallParams): Promise<InstallResult> {
    const backupPath = await backupSettings();
    const settings = await readSettings();
    const { updated, eventsInstalled } = installHooksIntoSettings(settings, apiUrl, token);
    await writeSettings(updated);
    return { eventsInstalled, backupPath };
  },

  async removeHooks(apiUrl: string): Promise<RemoveResult> {
    const settings = await readSettings();
    const { updated, eventsRemoved } = removeHooksFromSettings(settings, apiUrl);
    await writeSettings(updated);
    return { eventsRemoved };
  },

  async listInstalledHooks(apiUrl: string): Promise<InstalledHook[]> {
    const settings = await readSettings();
    return listClobbyHooks(settings, apiUrl);
  },
};
