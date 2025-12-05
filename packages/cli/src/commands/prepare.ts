import { runGenerationPipeline } from "../pipeline/generation";
import type { OpacaCommand } from "../types";

export const prepareCommand: OpacaCommand = {
  name: "prepare",
  description: "Synchronizes generated artifacts (routes, build runner).",
  async run(ctx, args) {
    await runGenerationPipeline({
      ...ctx,
      clean: true,
      watchMode: Boolean(args.flags["watch"]),
      verbose: Boolean(args.flags["verbose"]),
    });
  },
};
