import type { ScaffoldOptions } from "../types";
import { scaffoldBaseTemplate } from "./template-base";

export async function scaffoldProject(opts: ScaffoldOptions) {
  switch (opts.template) {
    case "base":
    default:
      await scaffoldBaseTemplate(opts);
      break;
  }
}
