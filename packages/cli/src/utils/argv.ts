import type { CommandArgs } from "../types";

const DEFAULT_SKIP = new Set(["config", "runtime", "task-runner", "watch", "open", "port", "r"]);

function formatFlag(key: string, value: unknown): string[] {
  if (value === false) {
    return [`--no-${key}`];
  }

  if (value === true) {
    return [`${key.length === 1 ? `-${key}` : `--${key}`}`];
  }

  if (Array.isArray(value)) {
    return [`${key.length === 1 ? `-${key}` : `--${key}`}=${value.join(",")}`];
  }

  return [`${key.length === 1 ? `-${key}` : `--${key}`}=${value}`];
}

export function buildArgList(
  args: CommandArgs,
  options?: {
    configFile?: string;
    skip?: Iterable<string>;
    includePositional?: boolean;
  }
): string[] {
  const skipSet = new Set(DEFAULT_SKIP);
  if (options?.skip) {
    for (const key of options.skip) {
      skipSet.add(key);
    }
  }

  const argv: string[] = [];
  if (options?.configFile) {
    argv.push("--config", options.configFile);
  }

  for (const [key, value] of Object.entries(args.flags)) {
    if (skipSet.has(key)) continue;
    argv.push(...formatFlag(key, value));
  }

  if (options?.includePositional ?? true) {
    argv.push(...args.positional);
  }

  return argv;
}
