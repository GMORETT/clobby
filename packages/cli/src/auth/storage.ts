import { chmod, mkdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { platform } from "process";

export interface AuthData {
  version: 1;
  apiUrl: string;
  token: string;
  userId: string;
  username: string;
  createdAt: string;
}

function getConfigDir(): string {
  if (process.env.CLOBBY_CONFIG_DIR) return process.env.CLOBBY_CONFIG_DIR;
  if (platform === "win32") {
    return join(process.env.APPDATA ?? homedir(), "clobby");
  }
  return join(homedir(), ".config", "clobby");
}

function getAuthPath(): string {
  return join(getConfigDir(), "auth.json");
}

export async function readAuth(): Promise<AuthData | null> {
  const path = getAuthPath();
  if (!existsSync(path)) return null;
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as AuthData;
  } catch {
    return null;
  }
}

export async function writeAuth(data: AuthData): Promise<void> {
  const dir = getConfigDir();
  await mkdir(dir, { recursive: true });
  const path = getAuthPath();
  await writeFile(path, JSON.stringify(data, null, 2), "utf8");
  try {
    await chmod(path, 0o600);
  } catch {
    // Windows doesn't support Unix permissions — best effort
  }
}

export async function clearAuth(): Promise<void> {
  const path = getAuthPath();
  if (existsSync(path)) {
    const { unlink } = await import("fs/promises");
    await unlink(path);
  }
}
