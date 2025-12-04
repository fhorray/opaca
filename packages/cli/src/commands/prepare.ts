import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spinner } from "@clack/prompts";
import { generateRoutes } from "@opaca/dev";
import { loadConfig } from "../utils/load-config";
import type { CommandContext } from "../types";
import { BUILD_RUNNER_TEMPLATE } from "../templates/build-runner-template";

export async function runPrepareCommand({ configFile }: CommandContext) {
  const s = spinner();
  s.start(`Preparing workspace with ${configFile}...`);
  const config = await loadConfig(configFile);
  const projectRoot = process.cwd();
  const bunaDir = resolve(projectRoot, config.outDir);

  await rm(bunaDir, { recursive: true, force: true }).catch(() => { });
  s.message("Generating Opaca routes...");
  await generateRoutes(config);

  await mkdir(bunaDir, { recursive: true });
  await ensureBuildRunnerScript(bunaDir);
  s.stop(".opaca directory refreshed.");
}

async function ensureBuildRunnerScript(bunaDir: string) {
  const target = join(bunaDir, "build.ts");
  await writeFile(target, BUILD_RUNNER_TEMPLATE, "utf8");
}
