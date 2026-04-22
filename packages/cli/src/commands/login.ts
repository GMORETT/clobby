import { runDeviceFlow } from "../auth/device-flow.js";
import { writeAuth, readAuth } from "../auth/storage.js";
import { apiGet } from "../api/client.js";

export async function loginCommand() {
  const existing = await readAuth();
  if (existing) {
    const check = await apiGet<{ username: string }>("/api/me", existing.token);
    if (check.ok) {
      console.log(`Already logged in as @${check.data.username}. Use \`clobby logout\` to switch accounts.`);
      return;
    }
    console.log("Existing token is invalid. Re-authenticating…\n");
  }

  const auth = await runDeviceFlow();
  await writeAuth(auth);
  console.log(`\nLogged in as @${auth.username}`);
  console.log(`Token saved to config. Run \`clobby install\` to set up hooks.`);
}
