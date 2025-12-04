import type { CommandContext } from "../types";
import { runTurboTask } from "../utils/turbo";

export async function runDevCommand({ args }: CommandContext) {
  const turboArgs = args.includes("--parallel")
    ? args
    : ["--parallel", ...args];

  await runTurboTask({ task: "dev", args: turboArgs });
}
