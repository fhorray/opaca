export const BUILD_RUNNER_TEMPLATE = `#!/usr/bin/env bun
import { runBunaBuild } from "opaca-dev";

type Runtime = "bun" | "node" | "cloudflare" | "deno";

function parseRuntimeFromArgs(argv: string[]): Runtime | undefined {
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--runtime") {
      return normalizeRuntime(argv[index + 1]);
    }
    if (arg.startsWith("--runtime=")) {
      const [, value] = arg.split("=", 2);
      return normalizeRuntime(value);
    }
  }
  return undefined;
}

function normalizeRuntime(value?: string): Runtime | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.toLowerCase();
  if (["bun", "node", "cloudflare", "deno"].includes(normalized)) {
    return normalized as Runtime;
  }
  return undefined;
}

function resolveRuntime(): Runtime {
  const fromArgs = parseRuntimeFromArgs(process.argv.slice(2));
  if (fromArgs) {
    return fromArgs;
  }
  const envRuntime = process.env.OPACA_RUNTIME;
  const normalized = normalizeRuntime(envRuntime);
  if (normalized) {
    return normalized;
  }
  return "bun";
}

const forwardedArgs = process.argv.slice(2);
const runtime = resolveRuntime();

await runBunaBuild({
  cwd: process.cwd(),
  argv: forwardedArgs,
  runtime,
});
`;
