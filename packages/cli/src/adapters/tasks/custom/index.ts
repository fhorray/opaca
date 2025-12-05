import { loadBuildAdapter } from "../../build";
import { runGenerationPipeline } from "../../../pipeline/generation";
import { resolveRuntime } from "../../../utils/runtime";
import type { TaskRunner, TaskRunnerOptions } from "../types";

export const customTaskRunner: TaskRunner = {
  name: "custom",
  supports(taskName) {
    return taskName === "build";
  },
  async runTask(taskName, ctx, options) {
    if (taskName !== "build") {
      throw new Error(`Custom runner does not support "${taskName}".`);
    }

    const commandArgs = options.commandArgs ?? { positional: [], flags: {} };
    const runtime = options.runtime ?? (await resolveRuntime(ctx, commandArgs));

    await runGenerationPipeline({
      ...ctx,
      watchMode: Boolean(options.watch),
      clean: Boolean(options.clean),
    });

    const adapter = loadBuildAdapter(runtime);
    const buildCtx = {
      ...ctx,
      runtime,
      args: commandArgs,
    };

    await adapter.prepare(buildCtx);
    await adapter.build(buildCtx);
    await adapter.postBuild?.(buildCtx);
  },
};
