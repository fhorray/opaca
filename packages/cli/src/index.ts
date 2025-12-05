#!/usr/bin/env bun
import { commands } from "./commands";
import { invokeFromDevtools, registerCommands, runCLI } from "./cli";

registerCommands(commands);

if (import.meta.main) {
  runCLI().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

export { invokeFromDevtools };
