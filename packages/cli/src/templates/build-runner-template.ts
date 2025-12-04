export const BUILD_RUNNER_TEMPLATE = `#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { runBunaBuild } from "@opaca/dev";

function readRuntimeMarker(): string | undefined {
  let current = process.cwd();
  while (true) {
    const candidate = path.join(current, ".opaca-runtime-target");
    if (existsSync(candidate)) {
      try {
        const content = readFileSync(candidate, "utf8").trim();
        return content || undefined;
      } catch {
        return undefined;
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return undefined;
}

function withRuntimeArgs(args: string[]): string[] {
  if (args.some(arg => arg.startsWith("--runtime"))) {
    return args;
  }

  const runtime = readRuntimeMarker();
  if (runtime) {
    return [...args, "--runtime", runtime];
  }

  return args;
}

const forwardedArgs = withRuntimeArgs(process.argv.slice(2));

await runBunaBuild({
  cwd: process.cwd(),
  argv: forwardedArgs,
});
`;
