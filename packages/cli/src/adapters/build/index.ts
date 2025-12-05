import type { BuildAdapter } from "./types";
import { createBunAdapter } from "./bun";
import { createCloudflareAdapter } from "./cloudflare";
import { createDenoAdapter } from "./deno";
import { createNodeAdapter } from "./node";
import type { BuildRuntime } from "../../utils/runtime";

export function loadBuildAdapter(runtime: BuildRuntime): BuildAdapter {
  switch (runtime) {
    case "bun":
      return createBunAdapter();
    case "node":
      return createNodeAdapter();
    case "cloudflare":
      return createCloudflareAdapter();
    case "deno":
      return createDenoAdapter();
    default:
      throw new Error(`Unsupported runtime "${runtime}".`);
  }
}
