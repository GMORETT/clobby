import { clearAuth, readAuth } from "../auth/storage.js";

export async function logoutCommand() {
  const auth = await readAuth();
  if (!auth) {
    console.log("Not logged in.");
    return;
  }
  await clearAuth();
  console.log(`Logged out. Hooks are still installed and will fail until you run \`clobby login\` again.`);
}
