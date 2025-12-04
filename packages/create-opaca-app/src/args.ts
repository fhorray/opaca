import type { CreateOptions, RuntimeTarget, TemplateId } from "./types.js";

function isRuntimeTarget(value: string): value is RuntimeTarget {
  return value === "bun" || value === "cloudflare";
}

export function parseArgs(argv: string[]): CreateOptions {
  let projectName: string | undefined;
  let runtime: RuntimeTarget | undefined;
  let template: TemplateId | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (!arg.startsWith("-") && !projectName) {
      projectName = arg;
      continue;
    }

    if (arg === "--runtime" || arg === "-r") {
      const next = argv[i + 1];
      if (!next) break;
      if (isRuntimeTarget(next)) {
        runtime = next;
      }
      i++;
      continue;
    }

    if (arg === "--template" || arg === "-t") {
      const next = argv[i + 1];
      if (!next) break;
      template = next as TemplateId;
      i++;
      continue;
    }
  }

  return { projectName, runtime, template };
}
