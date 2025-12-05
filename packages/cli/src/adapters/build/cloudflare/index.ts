import type { BuildAdapter } from "../types";
import { createBunaAdapter } from "../common";

export function createCloudflareAdapter(): BuildAdapter {
  return createBunaAdapter("cloudflare");
}
