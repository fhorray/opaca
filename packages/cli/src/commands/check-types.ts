import type { CommandContext } from "../types";
import { runTurboTask } from "../utils/turbo";

export async function runCheckTypesCommand({ args }: CommandContext) {
  await runTurboTask({ task: "check-types", args });
}
