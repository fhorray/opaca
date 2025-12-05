import { runGenerationPipeline } from "../pipeline/generation";
import type { OpacaCommand } from "../types";

export const codegenCommand: OpacaCommand = {
  name: "codegen",
  description: "Regenerates the routes defined in the config.",
  async run(ctx, args) {
    await runGenerationPipeline({
      ...ctx,
      watchMode: Boolean(args.flags["watch"]),
      verbose: Boolean(args.flags["verbose"]),
    });
  },
};
