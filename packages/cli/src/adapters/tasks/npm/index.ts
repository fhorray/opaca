import { spawn } from "node:child_process";
import type { SpawnOptions } from "node:child_process";
import type { TaskRunner } from "../types";

const SUPPORTED_TASKS = new Set(["dev", "build", "check-types"]);

export const npmTaskRunner: TaskRunner = {
  name: "npm",
  supports(taskName) {
    return SUPPORTED_TASKS.has(taskName);
  },
  async runTask(taskName, ctx, options) {
    const npmArgs = ["run", taskName, "--", ...(options.args ?? [])];
    await spawnBinary("npm", npmArgs, {
      cwd: ctx.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
    });
  },
};

async function spawnBinary(command: string, args: string[], options: SpawnOptions) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false, ...options });
    child.on("exit", code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code ?? "unknown"}.`));
      }
    });
    child.on("error", err => reject(err));
  });
}
