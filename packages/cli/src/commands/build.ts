import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveRuntime } from "../utils/runtime";
import type { OpacaCommand } from "../types";
import { buildArgList } from "../utils/argv";

function resolveTargetCwd(cwd: string): string {
  try {
    const pkgPath = join(cwd, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string } | undefined;
    if (pkg?.name === "opaca-monorepo") {
      const playgroundDir = join(cwd, "apps", "playground");
      if (existsSync(join(playgroundDir, "package.json"))) {
        return playgroundDir;
      }
    }
  } catch {
    // ignore and fall back to original cwd
  }
  return cwd;
}

export const buildCommand: OpacaCommand = {
  name: "build",
  description: "Runs the build pipeline using Bun.",
  async run(ctx, args) {
    const runtime = await resolveRuntime(ctx, args);
    const extraArgs = buildArgList(args, {
      // runtime and config file are forwarded explicitly
      skip: ["clean"],
    });

    const targetCwd = resolveTargetCwd(ctx.cwd);
    const bunArgs = ["run", "build", "--", "--runtime", runtime, ...extraArgs];

    await new Promise<void>((resolve, reject) => {
      const child = spawn("bun", bunArgs, {
        cwd: targetCwd,
        stdio: "inherit",
        shell: false,
        env: ctx.env,
      });

      child.on("exit", code => {
        if (code === 0) resolve();
        else reject(new Error(`bun run build exited with code ${code ?? "unknown"}.`));
      });

      child.on("error", err => reject(err));
    });
  },
};
