import { spawn } from "node:child_process";
import type { SpawnOptions } from "node:child_process";
import { note } from "@clack/prompts";
import { findWorkspaceRoot, resolveTurboBin } from "./workspace";

type TurboTask = "dev" | "build" | "check-types";

interface RunTurboOptions {
  args: string[];
  task: TurboTask;
  env?: NodeJS.ProcessEnv;
}

export async function runTurboTask(options: RunTurboOptions) {
  const workspaceRoot = findWorkspaceRoot();
  if (!workspaceRoot) {
    throw new Error('Could not find a "turbo.json" to identify the monorepo.');
  }

  const turboBin = resolveTurboBin(workspaceRoot);
  if (!turboBin) {
    throw new Error(
      "Turbo is not installed. Run `bun install` to install the dependencies."
    );
  }

  note(`root: ${workspaceRoot}`, `turbo ${options.task}`);

  const turboArgs = ["run", options.task, ...options.args];
  const env = { ...process.env, ...options.env };
  const spawnOpts: SpawnOptions = {
    cwd: workspaceRoot,
    stdio: "inherit",
    shell: false,
    env,
  };

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(turboBin, turboArgs, spawnOpts);

    child.on("exit", code => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`Turbo exited with code ${code ?? "unknown"}.`));
      }
    });

    child.on("error", err => {
      rejectPromise(err);
    });
  });
}
