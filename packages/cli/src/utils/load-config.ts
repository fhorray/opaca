import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { defineConfig } from "opaca";
import type { BunaConfig, ResolvedBunaConfig } from "opaca/core";

export async function loadConfig(configFile: string): Promise<ResolvedBunaConfig> {
  const configPath = resolve(process.cwd(), configFile);
  const configUrl = pathToFileURL(configPath).href;

  const mod = await import(configUrl);
  const config = (mod.default ?? mod.config) as BunaConfig | undefined;

  if (!config) {
    throw new Error(`Config file "${configFile}" does not export a configuration.`);
  }

  return defineConfig(config);
}
