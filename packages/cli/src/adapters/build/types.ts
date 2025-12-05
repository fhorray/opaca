import type { CommandContext, CommandArgs } from "../../types";
import type { BuildRuntime } from "../../utils/runtime";

export interface BuildContext extends CommandContext {
  runtime: BuildRuntime;
  args: CommandArgs;
}

export interface BuildAdapter {
  name: string;
  prepare(ctx: BuildContext): Promise<void>;
  build(ctx: BuildContext): Promise<void>;
  postBuild?(ctx: BuildContext): Promise<void>;
}
