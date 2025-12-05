import type { CommandArgs, FlagValue } from "../types";

function parseLiteral(value: string): FlagValue {
  if (value === "true") return true;
  if (value === "false") return false;
  if (!Number.isNaN(Number(value)) && value.trim() !== "") {
    return Number(value);
  }
  return value;
}

export interface ParsedCommandLine {
  commandName?: string;
  helpRequested: boolean;
  configFile: string;
  args: CommandArgs;
}

export function parseCommandLine(argv: string[]): ParsedCommandLine {
  const flags: Record<string, FlagValue> = {};
  const positional: string[] = [];
  let helpRequested = false;
  let configFile = "opaca.config.ts";

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;

    if (arg === "--help" || arg === "-h") {
      helpRequested = true;
      continue;
    }

    if (arg === "--config") {
      const next = argv[index + 1];
      if (next) {
        configFile = next;
        index++;
      }
      continue;
    }

    if (arg.startsWith("--")) {
      let key = arg.slice(2);
      let value: FlagValue | undefined = true;

      if (key.startsWith("no-")) {
        key = key.slice(3);
        value = false;
      } else if (key.includes("=")) {
        const [parsedKey, parsedValue] = key.split("=", 2);
        key = parsedKey;
        value = parseLiteral(parsedValue);
      } else if (argv[index + 1] && !argv[index + 1].startsWith("-")) {
        value = parseLiteral(argv[index + 1]);
        index++;
      }

      flags[key] = value;
      continue;
    }

    if (arg.startsWith("-") && arg.length > 1) {
      const key = arg.slice(1);
      let value: FlagValue = true;
      if (argv[index + 1] && !argv[index + 1].startsWith("-")) {
        value = parseLiteral(argv[index + 1]);
        index++;
      }
      flags[key] = value;
      continue;
    }

    positional.push(arg);
  }

  const commandName = positional.shift();
  return {
    commandName,
    helpRequested,
    configFile,
    args: { positional, flags },
  };
}

export function getFlagValue(
  flags: CommandArgs["flags"],
  keys: string[]
): FlagValue | undefined {
  for (const key of keys) {
    if (key in flags) {
      return flags[key];
    }
  }
  return undefined;
}
