import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { type BuildRuntime as OpacaBuildRuntime, isBuildRuntime } from "opaca-dev";
import type { CommandArgs, CommandContext } from "../types";
import { getFlagValue } from "./flags";

export type BunaBuildRuntime = OpacaBuildRuntime;
export type BuildRuntime = BunaBuildRuntime | "deno";

const DEFAULT_RUNTIME: BuildRuntime = "bun";

export async function resolveRuntime(ctx: CommandContext, args: CommandArgs): Promise<BuildRuntime> {
  const runtimeFromFlag = getFlagValue(args.flags, ["runtime", "r"]);
  const resolved = await resolveRuntimeValue(runtimeFromFlag, ctx);
  return resolved ?? DEFAULT_RUNTIME;
}

async function resolveRuntimeValue(
  candidate: unknown,
  ctx: CommandContext
): Promise<BuildRuntime | undefined> {
  if (typeof candidate === "string") {
    const normalized = candidate.toLowerCase();
    if (isBunaRuntime(normalized)) {
      return normalized;
    }
    if (normalized === "deno") {
      return "deno";
    }
  }
  const envRuntime = ctx.env.OPACA_RUNTIME ?? ctx.env.OPACA_RUNTIME_TARGET;
  if (typeof envRuntime === "string") {
    const normalized = envRuntime.toLowerCase();
    if (isBunaRuntime(normalized)) {
      return normalized;
    }
    if (normalized === "deno") {
      return "deno";
    }
  }

  const configRuntime = await loadRuntimeFromConfig(ctx.cwd, ctx.configFile);
  if (configRuntime) {
    return configRuntime;
  }

  return undefined;
}

async function loadRuntimeFromConfig(
  cwd: string,
  configFile: string
): Promise<BuildRuntime | undefined> {
  try {
    const resolved = resolve(cwd, configFile);
    const url = pathToFileURL(resolved).href;
    const mod = await import(url);
    const rawConfig = (mod.default ?? mod.config) as Record<string, unknown> | undefined;
    if (!rawConfig) return undefined;

  const runtimeValue = rawConfig.runtime;
  if (typeof runtimeValue === "string") {
    const normalized = runtimeValue.toLowerCase();
    if (isBunaRuntime(normalized)) {
      return normalized;
    }
    if (normalized === "deno") {
      return "deno";
    }
  }
  } catch {
    // Ignore failures to keep CLI resilient.
  }

  return undefined;
}

function isBunaRuntime(value: string): value is BunaBuildRuntime {
  return isBuildRuntime(value);
}
