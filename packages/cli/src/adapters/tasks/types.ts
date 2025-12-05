import type { CommandArgs, CommandContext } from "../../types";
import type { BuildRuntime } from "../../utils/runtime";

export interface TaskRunnerOptions {
  args?: string[];
  env?: NodeJS.ProcessEnv;
  runtime?: BuildRuntime;
  watch?: boolean;
  clean?: boolean;
  commandArgs?: CommandArgs;
}

export interface TaskRunner {
  name: string;
  supports(taskName: string): boolean;
  detect?(ctx: CommandContext): boolean | Promise<boolean>;
  runTask(taskName: string, ctx: CommandContext, options: TaskRunnerOptions): Promise<void>;
}
