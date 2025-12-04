import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cancel, isCancel, note, select } from "@clack/prompts";
import { BUILD_RUNTIME_PRESETS, isBuildRuntime, type BuildRuntime } from "opaca-dev";
import type { CommandContext } from "../types";
import { runTurboTask } from "../utils/turbo";
import { findWorkspaceRoot } from "../utils/workspace";

const BUILD_RUNTIME_MARKER = ".opaca-runtime-target";

const BUILD_TARGET_OPTIONS = (Object.keys(
  BUILD_RUNTIME_PRESETS
) as BuildRuntime[]).map(value => {
  const preset = BUILD_RUNTIME_PRESETS[value];
  return {
    value,
    label: preset.label,
    hint: preset.hint,
  };
});

export async function runBuildCommand({ args }: CommandContext) {
  const { runtime, rest } = extractBuildRuntimeArg(args);
  const selectedRuntime = await ensureBuildRuntimeSelection(runtime);
  note(`alvo: ${selectedRuntime}`, "opaca build");

  const workspaceRoot = findWorkspaceRoot();
  if (!workspaceRoot) {
    throw new Error('Could not find a "turbo.json" to identify the monorepo.');
  }

  const shouldCreateMarker = selectedRuntime !== "bun";
  if (shouldCreateMarker) {
    await writeRuntimeMarker(workspaceRoot, selectedRuntime);
  }

  try {
    await runTurboTask({ task: "build", args: rest });
  } finally {
    if (shouldCreateMarker) {
      await removeRuntimeMarker(workspaceRoot).catch(() => { });
    }
  }
}

function extractBuildRuntimeArg(args: string[]): { runtime?: BuildRuntime; rest: string[] } {
  const rest: string[] = [];
  let runtime: BuildRuntime | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg === "--runtime" || arg === "-r") {
      const value = args[i + 1];
      if (value && isBuildRuntime(value.toLowerCase())) {
        runtime = value.toLowerCase() as BuildRuntime;
      }
      i++;
      continue;
    }

    if (arg.startsWith("--runtime=")) {
      const [, raw] = arg.split("=", 2);
      if (raw && isBuildRuntime(raw.toLowerCase())) {
        runtime = raw.toLowerCase() as BuildRuntime;
      }
      continue;
    }

    rest.push(arg);
  }

  return { runtime, rest };
}

async function ensureBuildRuntimeSelection(runtime?: BuildRuntime): Promise<BuildRuntime> {
  if (runtime) {
    return runtime;
  }

  const selection = await select({
    message: "Qual alvo de build deseja utilizar?",
    options: BUILD_TARGET_OPTIONS,
  });

  if (isCancel(selection)) {
    cancel("Build cancelado.");
    process.exit(0);
  }

  return selection as BuildRuntime;
}

async function writeRuntimeMarker(root: string, runtime: BuildRuntime) {
  const markerPath = join(root, BUILD_RUNTIME_MARKER);
  await writeFile(markerPath, runtime, "utf8");
}

async function removeRuntimeMarker(root: string) {
  const markerPath = join(root, BUILD_RUNTIME_MARKER);
  await rm(markerPath, { force: true }).catch(() => { });
}
