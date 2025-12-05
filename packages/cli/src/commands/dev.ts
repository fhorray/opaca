import { loadTaskRunner } from "../adapters/tasks";
import { buildArgList } from "../utils/argv";
import type { OpacaCommand } from "../types";

export const devCommand: OpacaCommand = {
  name: "dev",
  description: "Starts the development task runner.",
  async run(ctx, args) {
    const runner = await loadTaskRunner(ctx, "dev", args);
    await runner.runTask("dev", ctx, {
      args: buildArgList(args),
      commandArgs: args,
    });
  },
};
