export type RuntimeTarget = "bun" | "cloudflare";

export type TemplateId = "base";

export interface CreateOptions {
  projectName?: string;
  runtime?: RuntimeTarget;
  template?: TemplateId;
}

export interface ScaffoldOptions {
  dir: string;
  name: string;
  runtime: RuntimeTarget;
  template: TemplateId;
}
