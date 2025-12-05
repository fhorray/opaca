import { loadTaskRunner } from "../adapters/tasks";
import { buildArgList } from "../utils/argv";
import type { OpacaCommand } from "../types";

export const checkTypesCommand: OpacaCommand = {
  name: "check-types",
  description: "Validates the workspace types.",
  async run(ctx, args) {
    const runner = await loadTaskRunner(ctx, "check-types", args);
    await runner.runTask("check-types", ctx, {
      args: buildArgList(args),
      commandArgs: args,
    });
  },
};
