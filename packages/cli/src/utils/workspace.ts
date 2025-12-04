import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

export function findWorkspaceRoot(start = process.cwd()): string | null {
  let current = start;
  while (true) {
    if (existsSync(join(current, "turbo.json"))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

export function resolveTurboBin(root: string): string | null {
  const binDir = join(root, "node_modules", ".bin");
  const isWindows = process.platform === "win32";
  const candidates = isWindows
    ? ["turbo.exe", "turbo.cmd", "turbo.bunx"]
    : ["turbo", "turbo.exe"];

  for (const candidate of candidates) {
    const fullPath = join(binDir, candidate);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}
