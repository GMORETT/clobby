export interface DetectResult {
  installed: boolean;
  configPath: string | null;
  version?: string;
}

export interface InstallParams {
  token: string;
  apiUrl: string;
}

export interface InstallResult {
  eventsInstalled: string[];
  backupPath: string;
}

export interface RemoveResult {
  eventsRemoved: string[];
}

export interface InstalledHook {
  event: string;
  url: string;
}

export interface Harness {
  id: "claude_code" | "codex" | "cursor";
  displayName: string;
  detect(): Promise<DetectResult>;
  isInstalled(): Promise<boolean>;
  installHooks(params: InstallParams): Promise<InstallResult>;
  removeHooks(apiUrl: string): Promise<RemoveResult>;
  listInstalledHooks(apiUrl: string): Promise<InstalledHook[]>;
}
