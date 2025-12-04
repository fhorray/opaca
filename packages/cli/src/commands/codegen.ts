import { spinner } from "@clack/prompts";
import { generateRoutes } from "opaca-dev";
import { loadConfig } from "../utils/load-config";
import type { CommandContext } from "../types";

export async function runCodegenCommand({ configFile }: CommandContext) {
  const s = spinner();
  s.start(`Generating routes from ${configFile}...`);
  const config = await loadConfig(configFile);
  await generateRoutes(config);
  s.stop("Routes updated successfully!");
}
