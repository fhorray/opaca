import type { BuildAdapter, BuildContext } from "../types";

export function createDenoAdapter(): BuildAdapter {
  return {
    name: "deno",
    async prepare() {
      // Deno runtime support is not implemented yet.
    },
    async build() {
      throw new Error("Deno build runtime is not supported yet.");
    },
  };
}
