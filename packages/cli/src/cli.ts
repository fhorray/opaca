import { cancel, intro, isCancel, log, outro, select } from "@clack/prompts";
import { parseCommandLine } from "./utils/flags";
import type { CommandArgs, CommandContext, OpacaCommand } from "./types";

type RunOptions = {
  configFile?: string;
  cwd?: string;
};

const commandRegistry = new Map<string, OpacaCommand>();

export function registerCommands(commands: OpacaCommand[]) {
  for (const command of commands) {
    if (commandRegistry.has(command.name)) {
      throw new Error(`Command "${command.name}" is already registered.`);
    }
    commandRegistry.set(command.name, command);
  }
}

export async function runCLI(argv: string[] = process.argv.slice(2)) {
  const parsed = parseCommandLine(argv);
  if (parsed.helpRequested) {
    printHelp();
    return;
  }

  const commandName = parsed.commandName ?? (await promptForCommand());
  if (!commandName) {
    log.error("No command selected.");
    process.exit(1);
  }

  const command = commandRegistry.get(commandName);
  if (!command) {
    log.error(`Unknown command: ${commandName}`);
    printHelp();
    process.exit(1);
  }

  intro("Opaca CLI");
  try {
    await runCommand(commandName, parsed.args, {
      configFile: parsed.configFile,
    });
    outro(`Command "${commandName}" finished.`);
  } catch (error) {
    log.error(
      error instanceof Error ? error.message : "Unexpected error while running the command."
    );
    process.exit(1);
  }
}

export async function runCommand(
  name: string,
  args: CommandArgs,
  options: RunOptions = {}
) {
  const command = commandRegistry.get(name);
  if (!command) {
    throw new Error(`Command "${name}" is not registered.`);
  }

  const cwd = options.cwd ?? process.cwd();
  const configFile = options.configFile ?? "opaca.config.ts";
  const ctx: CommandContext = {
    cwd,
    configFile,
    env: process.env,
    workspaceRoot: null,
  };

  await command.run(ctx, args);
}

export async function invokeFromDevtools(commandName: string, args: CommandArgs) {
  await runCommand(commandName, args);
}

async function promptForCommand(): Promise<string | undefined> {
  if (!commandRegistry.size) {
    log.error("No commands have been registered.");
    process.exit(1);
  }

  const options = Array.from(commandRegistry.values()).map(command => ({
    label: `${command.name} — ${command.description}`,
    value: command.name,
  }));

  const selection = await select({
    message: "Which command do you want to run?",
    options,
  });

  if (isCancel(selection)) {
    cancel("No command selected.");
    process.exit(0);
  }

  return typeof selection === "string" ? selection : undefined;
}

function printHelp() {
  console.log(`Opaca CLI

Usage:
  opaca <command> [options]

Commands:`);

  for (const command of commandRegistry.values()) {
    console.log(`  ${command.name.padEnd(15)} ${command.description}`);
  }

  console.log(`
Options:
  --config <file>     Loads the given config file (default: opaca.config.ts)
  --runtime <target>  Selects build runtime (bun|node|cloudflare|deno)
  -h, --help          Show this message
`);
}
