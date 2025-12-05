import type { CommandArgs, CommandContext } from "../../types";
import { getFlagValue } from "../../utils/flags";
import { bunTaskRunner } from "./bun";
import { customTaskRunner } from "./custom";
import { npmTaskRunner } from "./npm";
import { turboTaskRunner } from "./turbo";
import type { TaskRunner } from "./types";

const ALL_RUNNERS: Record<string, TaskRunner> = {
  custom: customTaskRunner,
  turbo: turboTaskRunner,
  bun: bunTaskRunner,
  npm: npmTaskRunner,
};

const BUILD_ORDER = ["custom", "turbo", "bun", "npm"];
const DEFAULT_ORDER = ["turbo", "bun", "npm", "custom"];

export async function loadTaskRunner(
  ctx: CommandContext,
  taskName: string,
  args: CommandArgs
): Promise<TaskRunner> {
  const requested = getFlagValue(args.flags, ["task-runner"]);
  const envRequested =
    typeof ctx.env.OPACA_TASK_RUNNER === "string"
      ? ctx.env.OPACA_TASK_RUNNER.toLowerCase()
      : undefined;
  const preferred = (typeof requested === "string" ? requested.toLowerCase() : envRequested) ?? undefined;

  if (preferred) {
    const runner = ALL_RUNNERS[preferred];
    if (!runner) {
      throw new Error(`Unknown task runner "${preferred}". Known runners: ${Object.keys(ALL_RUNNERS).join(", ")}`);
    }
    if (!runner.supports(taskName)) {
      throw new Error(`Task runner "${preferred}" does not support "${taskName}".`);
    }
    if (runner.detect && !(await runner.detect(ctx))) {
      throw new Error(`Task runner "${preferred}" cannot detect a suitable environment.`);
    }
    return runner;
  }

  const order = taskName === "build" ? BUILD_ORDER : DEFAULT_ORDER;

  for (const key of order) {
    const runner = ALL_RUNNERS[key];
    if (!runner || !runner.supports(taskName)) continue;
    if (runner.detect && !(await runner.detect(ctx))) {
      continue;
    }
    return runner;
  }

  throw new Error(`No task runner could be identified for ${taskName}.`);
}
