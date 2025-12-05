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

export const checkTypesCommand: OpacaCommand = {
  name: "check-types",
  description: "Validates the project types with Bun.",
  async run(ctx, args) {
    const extraArgs = buildArgList(args);
    const bunArgs = ["run", "check-types", "--", ...extraArgs];
    const targetCwd = resolveTargetCwd(ctx.cwd);

    await new Promise<void>((resolve, reject) => {
      const child = spawn("bun", bunArgs, {
        cwd: targetCwd,
        stdio: "inherit",
        shell: false,
        env: ctx.env,
      });

      child.on("exit", code => {
        if (code === 0) resolve();
        else reject(new Error(`bun run check-types exited with code ${code ?? "unknown"}.`));
      });

      child.on("error", err => reject(err));
    });
  },
};
