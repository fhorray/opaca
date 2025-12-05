import { runBunaBuild } from "opaca-dev";
import type { BuildAdapter, BuildContext } from "./types";
import type { BunaBuildRuntime } from "../../utils/runtime";
import { buildArgList } from "../../utils/argv";

export function createBunaAdapter(runtime: BunaBuildRuntime): BuildAdapter {
  return {
    name: `buna:${runtime}`,
    async prepare() {
      // Generation pipeline should already handle prepare work.
    },
    async build(ctx) {
      const argv = buildArgsFromFlags(ctx);
      await runBunaBuild({
        runtime,
        cwd: ctx.cwd,
        argv,
      });
    },
    async postBuild() {
      // no-op by default
    },
  };
}

function buildArgsFromFlags(ctx: BuildContext): string[] {
  return buildArgList(ctx.args, { configFile: ctx.configFile });
}
