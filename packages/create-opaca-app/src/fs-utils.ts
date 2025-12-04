import { stat, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

export async function ensureEmptyDir(dir: string) {
  if (!existsSync(dir)) return;

  const stats = await stat(dir);
  if (!stats.isDirectory()) {
    throw new Error(`Target path "${dir}" exists and is not a directory.`);
  }

  const contents = await stat(join(dir, ".")).catch(() => null);
  if (contents && (await isNonEmpty(dir))) {
    throw new Error(
      `Target directory "${dir}" is not empty. Please choose another name or remove its contents.`
    );
  }
}

async function isNonEmpty(dir: string): Promise<boolean> {
  const files = await readdir(dir);
  return files.length > 0;
}
