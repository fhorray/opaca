import type { ScaffoldOptions } from "../types.js";
import { scaffoldBaseTemplate } from "./template-base.js";

export async function scaffoldProject(opts: ScaffoldOptions) {
  switch (opts.template) {
    case "base":
    default:
      await scaffoldBaseTemplate(opts);
      break;
  }
}
