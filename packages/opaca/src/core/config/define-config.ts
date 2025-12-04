import { DEFAULT_OUT_DIR, DEFAULT_ROUTES_DIR } from "../../constants";
import type { BunaConfig, ResolvedBunaConfig } from "./types";
import { resolve } from "node:path";

export function defineConfig(config: BunaConfig): ResolvedBunaConfig {
  const cwd = process.cwd();

  // if (!config.routesDir || !config.outDir) {
  //   throw new Error("opaca config requires 'routesDir' and 'outDir'.");
  // }

  return {
    routesDir: resolve(cwd, config.routesDir ?? DEFAULT_ROUTES_DIR),
    outDir: resolve(cwd, config.outDir ?? DEFAULT_OUT_DIR),
  };
}
