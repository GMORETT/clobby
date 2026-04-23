// Claude Code settings.json hook structure:
// { hooks: { EventName: [ { hooks: [{ type, url, headers }] } ] } }
// A "matcher group" is one element of the EventName array.
// We identify our matcher groups by checking if any inner hook URL starts with our API URL.

export type HookDef = {
  type: string;
  url: string;
  headers?: Record<string, string>;
};

export type MatcherGroup = {
  hooks: HookDef[];
  [key: string]: unknown;
};

export type ClaudeSettings = {
  hooks?: Record<string, MatcherGroup[]>;
  [key: string]: unknown;
};

function isClobbyGroup(group: MatcherGroup, apiUrl: string): boolean {
  return group.hooks?.some((h) => h.url.startsWith(`${apiUrl}/api/hooks/`)) ?? false;
}

export function installHooksIntoSettings(
  settings: ClaudeSettings,
  apiUrl: string,
  token: string,
): { updated: ClaudeSettings; eventsInstalled: string[] } {
  const events: Record<string, string> = {
    SessionStart: `${apiUrl}/api/hooks/session-start`,
    UserPromptSubmit: `${apiUrl}/api/hooks/user-prompt-submit`,
    Stop: `${apiUrl}/api/hooks/stop`,
    Notification: `${apiUrl}/api/hooks/notification`,
  };

  const hooks: Record<string, MatcherGroup[]> = { ...(settings.hooks ?? {}) };

  for (const [event, url] of Object.entries(events)) {
    const existing: MatcherGroup[] = hooks[event] ?? [];
    // Remove any stale Clobby group for this event before re-adding
    const others = existing.filter((g) => !isClobbyGroup(g, apiUrl));
    const clobbyGroup: MatcherGroup = {
      hooks: [{ type: "http", url, headers: { Authorization: `Bearer ${token}` } }],
    };
    hooks[event] = [...others, clobbyGroup];
  }

  return {
    updated: { ...settings, hooks },
    eventsInstalled: Object.keys(events),
  };
}

export function removeHooksFromSettings(
  settings: ClaudeSettings,
  apiUrl: string,
): { updated: ClaudeSettings; eventsRemoved: string[] } {
  if (!settings.hooks) return { updated: settings, eventsRemoved: [] };

  const hooks: Record<string, MatcherGroup[]> = {};
  const eventsRemoved: string[] = [];

  for (const [event, groups] of Object.entries(settings.hooks)) {
    const remaining = groups.filter((g) => !isClobbyGroup(g, apiUrl));
    if (remaining.length < groups.length) eventsRemoved.push(event);
    if (remaining.length > 0) hooks[event] = remaining;
  }

  const updated: ClaudeSettings = { ...settings };
  if (Object.keys(hooks).length === 0) {
    delete updated.hooks;
  } else {
    updated.hooks = hooks;
  }

  return { updated, eventsRemoved };
}

export function listClobbyHooks(
  settings: ClaudeSettings,
  apiUrl: string,
): Array<{ event: string; url: string }> {
  if (!settings.hooks) return [];
  const result: Array<{ event: string; url: string }> = [];
  for (const [event, groups] of Object.entries(settings.hooks)) {
    for (const group of groups) {
      if (isClobbyGroup(group, apiUrl)) {
        for (const h of group.hooks) {
          result.push({ event, url: h.url });
        }
      }
    }
  }
  return result;
}
