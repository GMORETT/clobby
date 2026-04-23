import * as clack from "@clack/prompts";
import { clearAuth, readAuth } from "../auth/storage.js";
import { HARNESSES } from "../harnesses/registry.js";
import { unregisterStartup, isStartupRegistered } from "../daemon/startup.js";

export async function uninstallCommand() {
  clack.intro("Clobby — uninstall");

  const auth = await readAuth();
  const apiUrl = auth?.apiUrl ?? "https://clobby.app";

  const withHooks = await Promise.all(
    HARNESSES.map(async (h) => ({
      harness: h,
      hooks: await h.listInstalledHooks(apiUrl),
    }))
  );
  const installed = withHooks.filter((w) => w.hooks.length > 0);
  const daemonRegistered = isStartupRegistered();

  if (installed.length === 0 && !daemonRegistered) {
    clack.log.info("No Clobby components found.");
  } else {
    if (daemonRegistered) clack.log.info("Background daemon: registered for startup");
    for (const { harness, hooks } of installed) {
      clack.log.info(`${harness.displayName}: ${hooks.length} hook(s) installed`);
    }
  }

  const proceed = await clack.confirm({ message: "Remove all Clobby components?" });
  if (clack.isCancel(proceed) || !proceed) {
    clack.outro("Cancelled.");
    return;
  }

  if (daemonRegistered) {
    unregisterStartup();
    clack.log.success("Daemon removed from startup");
  }

  for (const { harness } of installed) {
    const result = await harness.removeHooks(apiUrl);
    clack.log.success(`${harness.displayName}: removed ${result.eventsRemoved.join(", ")}`);
  }

  const removeAuth = await clack.confirm({ message: "Also remove saved credentials?" });
  if (!clack.isCancel(removeAuth) && removeAuth) {
    await clearAuth();
    clack.log.success("Credentials removed.");
    clack.log.warn("Note: your CLI token was NOT revoked on the server. Revoke it at the lobby if needed.");
  }

  clack.outro("Uninstalled.");
}
