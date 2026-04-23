import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/daemon.ts"],
  format: ["esm"],
  clean: true,
  dts: true,
  noExternal: ["@clobby/schemas"],
});
