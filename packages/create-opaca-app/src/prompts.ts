import { text, select, cancel, isCancel } from "@clack/prompts";
import type { RuntimeTarget, TemplateId } from "./types";

export async function ensureProjectName(initial?: string): Promise<string> {
  if (initial) return initial;

  const value = await text({
    message: "Project name?",
    placeholder: "my-opaca-app",
    validate: (v: string | undefined) =>
      !v || !v.trim() ? "Please provide a project name." : undefined,
  });

  if (isCancel(value)) {
    cancel("No project created.");
    process.exit(0);
  }

  return String(value);
}

export async function ensureRuntimeTarget(
  initial?: RuntimeTarget
): Promise<RuntimeTarget> {
  if (initial) return initial;

  const value = await select({
    message: "Target runtime?",
    options: [
      { value: "bun", label: "Bun (local server build)" },
      { value: "cloudflare", label: "Cloudflare Worker" },
    ],
  });

  if (isCancel(value)) {
    cancel("No project created.");
    process.exit(0);
  }

  if (value !== "bun" && value !== "cloudflare") {
    throw new Error("Invalid runtime selection.");
  }

  return value;
}

export async function ensureTemplate(
  initial?: TemplateId
): Promise<TemplateId> {
  if (initial) return initial;

  const value = await select({
    message: "Template?",
    options: [
      { value: "base", label: "Base starter (React + Tailwind)" },
      // depois você adiciona: minimal, spa, etc.
    ],
  });

  if (isCancel(value)) {
    cancel("No project created.");
    process.exit(0);
  }

  return value as TemplateId;
}
