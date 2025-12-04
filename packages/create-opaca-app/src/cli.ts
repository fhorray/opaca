import { resolve, basename } from "node:path";
import { intro, outro } from "@clack/prompts";
import { cyan, green } from "kolorist";
import type { CreateOptions } from "./types.js";
import { parseArgs } from "./args.js";
import { ensureProjectName, ensureRuntimeTarget, ensureTemplate } from "./prompts.js";
import { ensureEmptyDir } from "./fs-utils.js";
import { scaffoldProject } from "./scaffold/index.js";
import type { RuntimeTarget, TemplateId } from "./types.js";

export async function main(argv: string[]) {
  const options: CreateOptions = parseArgs(argv);

  intro(`${green("welcome")} to ${cyan("opaca()")}`);

  const projectName = await ensureProjectName(options.projectName);
  const runtime: RuntimeTarget = await ensureRuntimeTarget(options.runtime);
  const template: TemplateId = await ensureTemplate(options.template);

  const projectDir = resolve(process.cwd(), projectName);

  await ensureEmptyDir(projectDir);

  await scaffoldProject({
    dir: projectDir,
    name: basename(projectDir),
    runtime,
    template,
  });

  outro(buildOutro(projectName, runtime));
}

function buildOutro(projectName: string, runtime: RuntimeTarget): string {
  const lines = [
    `Project ready at ./${projectName}`,
    "",
    "Next steps:",
    `  cd ${projectName}`,
    "  bun install",
    "  bun run dev",
    "",
    runtime === "cloudflare"
      ? "- Build for Cloudflare: bun run build"
      : "- Build for Bun: bun run build",
  ];

  return lines.join("\n");
}
