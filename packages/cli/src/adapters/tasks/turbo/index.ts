import { spawn } from "node:child_process";
import type { SpawnOptions } from "node:child_process";
import { note } from "@clack/prompts";
import { findWorkspaceRoot, resolveTurboBin } from "../../../utils/workspace";
import type { TaskRunner, TaskRunnerOptions } from "../types";

const SUPPORTED_TASKS = new Set(["dev", "build", "check-types"]);

export const turboTaskRunner: TaskRunner = {
  name: "turbo",
  supports(taskName) {
    return SUPPORTED_TASKS.has(taskName);
  },
  detect(ctx) {
    const root = findWorkspaceRoot(ctx.cwd);
    if (!root) return false;
    return Boolean(resolveTurboBin(root));
  },
  async runTask(taskName, ctx, options) {
    const workspaceRoot = findWorkspaceRoot(ctx.cwd);
    if (!workspaceRoot) {
      throw new Error('Could not find a "turbo.json" to identify the monorepo.');
    }

    const turboBin = resolveTurboBin(workspaceRoot);
    if (!turboBin) {
      throw new Error("Turbo is not installed. Run `bun install` to install the dependencies.");
    }

    note(`root: ${workspaceRoot}`, `turbo ${taskName}`);

    const turboArgs = ["run", taskName, ...(options.args ?? [])];
    const env = { ...process.env, ...(options.env ?? {}) };
    const spawnOptions: SpawnOptions = {
      cwd: workspaceRoot,
      stdio: "inherit",
      shell: false,
      env,
    };

    await new Promise<void>((resolve, reject) => {
      const child = spawn(turboBin, turboArgs, spawnOptions);
      child.on("exit", code => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Turbo exited with code ${code ?? "unknown"}.`));
        }
      });
      child.on("error", err => reject(err));
    });
  },
};
