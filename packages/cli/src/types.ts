export type BunaCommand = "dev" | "build" | "check-types" | "codegen" | "prepare";

export interface CommandContext {
  args: string[];
  configFile: string;
}
