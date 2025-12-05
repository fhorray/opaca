import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildArgList } from "../utils/argv";
import type { OpacaCommand } from "../types";

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

export const devCommand: OpacaCommand = {
  name: "dev",
  description: "Starts the development server with Bun.",
  async run(ctx, args) {
    const targetCwd = resolveTargetCwd(ctx.cwd);
    const devArgs = ["run", "dev", "--", ...buildArgList(args)];

    await new Promise<void>((resolve, reject) => {
      const child = spawn("bun", devArgs, {
        cwd: targetCwd,
        stdio: "inherit",
        shell: false,
        env: ctx.env,
      });

      child.on("exit", code => {
        if (code === 0) resolve();
        else reject(new Error(`bun run dev exited with code ${code ?? "unknown"}.`));
      });

      child.on("error", err => reject(err));
    });
  },
};
