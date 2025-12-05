import { buildCommand } from "./build";
import { checkTypesCommand } from "./check-types";
import { codegenCommand } from "./codegen";
import { devCommand } from "./dev";
import { prepareCommand } from "./prepare";

export const commands = [
  devCommand,
  buildCommand,
  checkTypesCommand,
  codegenCommand,
  prepareCommand,
];
