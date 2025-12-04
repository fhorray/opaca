#!/usr/bin/env bun
import { cancel, intro, isCancel, log, outro, select } from "@clack/prompts";
import type { BunaCommand, CommandContext } from "./types";
import { runBuildCommand } from "./commands/build";
import { runCheckTypesCommand } from "./commands/check-types";
import { runCodegenCommand } from "./commands/codegen";
import { runDevCommand } from "./commands/dev";
import { runPrepareCommand } from "./commands/prepare";

interface ParsedCliArgs {
  command?: BunaCommand;
  args: string[];
  configFile: string;
  helpRequested: boolean;
  unknownCommand?: string;
}

const TURBO_TASK_HINT = {
  dev: "turbo run dev --parallel",
  build: "turbo run build + target bundler",
  "check-types": "turbo run check-types",
} as const;

function isBunaCommand(value: string): value is BunaCommand {
  return ["dev", "build", "check-types", "codegen", "prepare"].includes(value);
}

function parseCliArgs(argv: string[]): ParsedCliArgs {
  const rest: string[] = [];
  let helpRequested = false;
  let configFile = "opaca.config.ts";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;

    if (arg === "--help" || arg === "-h") {
      helpRequested = true;
      continue;
    }

    if (arg === "--config") {
      const value = argv[i + 1];
      if (value) {
        configFile = value;
        i++;
      }
      continue;
    }

    rest.push(arg);
  }

  if (rest.length === 0) {
    return { args: [], configFile, helpRequested };
  }

  const maybeCommand = rest[0];
  if (!maybeCommand) {
    return { args: rest, configFile, helpRequested };
  }

  if (!isBunaCommand(maybeCommand)) {
    return {
      args: rest.slice(1),
      configFile,
      helpRequested,
      unknownCommand: maybeCommand,
    };
  }

  return {
    command: maybeCommand,
    args: rest.slice(1),
    configFile,
    helpRequested,
  };
}

async function ensureCommand(command?: BunaCommand): Promise<BunaCommand> {
  if (command) {
    return command;
  }

  const selection = await select({
    message: "Which command do you want to run?",
    options: [
      {
        value: "dev",
        label: "Start development",
        hint: TURBO_TASK_HINT.dev,
      },
      {
        value: "build",
        label: "Full build",
        hint: TURBO_TASK_HINT.build,
      },
      {
        value: "check-types",
        label: "Check types",
        hint: TURBO_TASK_HINT["check-types"],
      },
      {
        value: "codegen",
        label: "Generate routes (opaca.config)",
        hint: "Updates .opaca/routes.generated.ts",
      },
      {
        value: "prepare",
        label: "Prepare workspace (.opaca)",
        hint: "Cleans and regenerates project-specific artifacts",
      },
    ],
  });

  if (isCancel(selection)) {
    cancel("No command selected.");
    process.exit(0);
  }

  return selection as BunaCommand;
}

function printHelp() {
  console.log(`Opaca CLI

Usage:
  opaca <command> [options]

Available commands:
  dev             Runs turbo in development mode (parallel)
  build           Runs the full build pipeline
  check-types     Validates types in all workspaces
  codegen         Generates the routes defined in opaca.config.ts
  prepare         Cleans .opaca and recreates helper scripts

Options:
  --config <file>     Uses an alternative config file for codegen
  --runtime <target>  Selects build target (bun|node|cloudflare) for "opaca build"
  -h, --help          Shows this help message

Examples:
  opaca dev --filter=apps/playground
  opaca build
  opaca codegen --config apps/playground/opaca.config.ts
`);
}

const commandHandlers: Record<BunaCommand, (ctx: CommandContext) => Promise<void>> = {
  dev: runDevCommand,
  build: runBuildCommand,
  "check-types": runCheckTypesCommand,
  codegen: runCodegenCommand,
  prepare: runPrepareCommand,
};

async function main() {
  const parsed = parseCliArgs(process.argv.slice(2));

  if (parsed.helpRequested) {
    printHelp();
    return;
  }

  if (parsed.unknownCommand) {
    log.error(`Unknown command: ${parsed.unknownCommand}`);
    printHelp();
    process.exit(1);
  }

  intro("Opaca CLI");

  const command = await ensureCommand(parsed.command);
  const handler = commandHandlers[command];

  if (!handler) {
    log.error(`Command "${command}" has no registered handler.`);
    process.exit(1);
  }

  try {
    await handler({ args: parsed.args, configFile: parsed.configFile });
    outro(`Command "${command}" finished.`);
  } catch (error) {
    log.error(
      error instanceof Error ? error.message : "Unknown error while executing the command."
    );
    process.exit(1);
  }
}

main().catch(error => {
  log.error(
    error instanceof Error ? error.message : "Unexpected error while running the CLI."
  );
  process.exit(1);
});
