import type { BuildAdapter } from "../types";
import { createBunaAdapter } from "../common";

export function createNodeAdapter(): BuildAdapter {
  return createBunaAdapter("node");
}
