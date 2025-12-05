import type { BuildAdapter } from "../types";
import { createBunaAdapter } from "../common";

export function createBunAdapter(): BuildAdapter {
  return createBunaAdapter("bun");
}
