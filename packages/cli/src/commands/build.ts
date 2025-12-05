import { loadTaskRunner } from "../adapters/tasks";
import { resolveRuntime } from "../utils/runtime";
import type { OpacaCommand } from "../types";
import { buildArgList } from "../utils/argv";

export const buildCommand: OpacaCommand = {
  name: "build",
  description: "Runs the build pipeline for the workspace.",
  async run(ctx, args) {
    const runtime = await resolveRuntime(ctx, args);
    const runner = await loadTaskRunner(ctx, "build", args);
    await runner.runTask("build", ctx, {
      runtime,
      clean: Boolean(args.flags["clean"]),
      commandArgs: args,
      args: buildArgList(args),
    });
  },
};
