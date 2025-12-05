export type FlagValue = string | boolean | number | Array<string | number>;

export interface CommandArgs {
  positional: string[];
  flags: Record<string, FlagValue>;
}

export interface CommandContext {
  cwd: string;
  configFile: string;
  env: NodeJS.ProcessEnv;
  workspaceRoot: string | null;
}

export interface OpacaCommand {
  name: string;
  description: string;
  run(ctx: CommandContext, args: CommandArgs): Promise<void>;
}
