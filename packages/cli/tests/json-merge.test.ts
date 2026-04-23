import { describe, it, expect } from "vitest";
import {
  installHooksIntoSettings,
  removeHooksFromSettings,
  listClobbyHooks,
  type ClaudeSettings,
} from "../src/utils/json-merge.js";

const API_URL = "http://localhost:3000";
const TOKEN = "clobby_live_test";

const gitButlerGroup = {
  hooks: [{ type: "http", url: "https://gitbutler.com/hooks/push" }],
};

function freshInstall(settings: ClaudeSettings) {
  return installHooksIntoSettings(settings, API_URL, TOKEN);
}

describe("installHooksIntoSettings", () => {
  it("empty settings — installs 3 events", () => {
    const { updated, eventsInstalled } = freshInstall({});
    expect(eventsInstalled).toHaveLength(3);
    expect(updated.hooks).toBeDefined();
    expect(Object.keys(updated.hooks!)).toEqual(
      expect.arrayContaining(["SessionStart", "Stop", "Notification"])
    );
  });

  it("settings with only Clobby hooks — re-installs without duplicating", () => {
    const { updated: first } = freshInstall({});
    const { updated: second } = freshInstall(first);
    // Each event should have exactly 1 matcher group
    for (const groups of Object.values(second.hooks!)) {
      expect(groups).toHaveLength(1);
    }
  });

  it("settings with GitButler hooks — appends without touching them", () => {
    const settings: ClaudeSettings = {
      hooks: { SessionStart: [gitButlerGroup] },
    };
    const { updated } = freshInstall(settings);
    const sessionStart = updated.hooks!.SessionStart;
    // GitButler group still there
    expect(sessionStart.some((g) => g === gitButlerGroup)).toBe(true);
    // Clobby group added
    expect(sessionStart.some((g) => g.hooks[0].url.includes("localhost:3000"))).toBe(true);
    expect(sessionStart).toHaveLength(2);
  });

  it("settings with mixed hooks — only re-adds Clobby", () => {
    const settings: ClaudeSettings = {
      hooks: { Stop: [gitButlerGroup] },
    };
    const { updated } = freshInstall(settings);
    const stop = updated.hooks!.Stop;
    expect(stop).toHaveLength(2);
    expect(stop[0]).toBe(gitButlerGroup);
  });
});

describe("removeHooksFromSettings", () => {
  it("removes only Clobby hooks, leaves GitButler intact", () => {
    const settings: ClaudeSettings = {
      hooks: {
        SessionStart: [gitButlerGroup, { hooks: [{ type: "http", url: `${API_URL}/api/hooks/session-start` }] }],
        Stop: [{ hooks: [{ type: "http", url: `${API_URL}/api/hooks/stop` }] }],
      },
    };
    const { updated, eventsRemoved } = removeHooksFromSettings(settings, API_URL);
    // GitButler group survives
    expect(updated.hooks!.SessionStart).toEqual([gitButlerGroup]);
    // Stop event removed entirely (no other hooks)
    expect(updated.hooks!.Stop).toBeUndefined();
    expect(eventsRemoved).toContain("Stop");
  });

  it("removes hooks key entirely when no hooks remain", () => {
    const { updated: installed } = freshInstall({});
    const { updated } = removeHooksFromSettings(installed, API_URL);
    expect(updated.hooks).toBeUndefined();
  });

  it("install then uninstall preserves other tools hooks exactly", () => {
    const original: ClaudeSettings = {
      hooks: {
        SessionStart: [gitButlerGroup],
        Stop: [gitButlerGroup],
      },
    };
    const { updated: installed } = freshInstall(original);
    const { updated: restored } = removeHooksFromSettings(installed, API_URL);
    expect(restored.hooks!.SessionStart).toEqual([gitButlerGroup]);
    expect(restored.hooks!.Stop).toEqual([gitButlerGroup]);
    // Notification was added by install but had no prior hooks — should be gone
    expect(restored.hooks!.Notification).toBeUndefined();
  });
});

describe("listClobbyHooks", () => {
  it("lists installed hooks", () => {
    const { updated } = freshInstall({});
    const hooks = listClobbyHooks(updated, API_URL);
    expect(hooks).toHaveLength(3);
    expect(hooks.map((h) => h.event)).toEqual(
      expect.arrayContaining(["SessionStart", "Stop", "Notification"])
    );
  });

  it("returns empty for settings with no Clobby hooks", () => {
    const settings: ClaudeSettings = { hooks: { SessionStart: [gitButlerGroup] } };
    expect(listClobbyHooks(settings, API_URL)).toHaveLength(0);
  });
});
