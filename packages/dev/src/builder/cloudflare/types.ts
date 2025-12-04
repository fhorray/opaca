import type { BunPlugin } from "bun";
import type { ResolvedBunaConfig } from "opaca";

export type WorkerAsset = {
  entryPath: string;
  fileName: string;
  urlPath: string;
  contentType: string;
};

export type HtmlRouteRecord = {
  pattern: string;
  html: string;
  regex: string | null;
};

export type BuildLog = {
  message: string;
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
};

export interface CloudflareBuildOptions {
  config: ResolvedBunaConfig;
  /** Directory where the worker file should be emitted. Defaults to `<config.outDir>/cloudflare`. */
  outDir?: string;
  /** URL prefix used for static assets served by the worker. */
  assetsBasePath?: string;
  /** Override the working directory for resolving relative paths. Defaults to `process.cwd()`. */
  projectRoot?: string;
  /** Whether client bundles should be minified. Defaults to true. */
  minify?: boolean;
  /** Cache-Control header for HTML routes. */
  htmlCacheControl?: string;
  /** Cache-Control header for JS/CSS assets. */
  assetCacheControl?: string;
}

export interface CloudflareBuildResult {
  workerPath: string;
  assets: number;
  routes: number;
}

export interface TransformContext {
  projectRoot: string;
  minify: boolean;
  assetsBasePath: string;
  assetCache: Map<string, WorkerAsset>;
  assets: WorkerAsset[];
  assetsDir: string;
  plugins: BunPlugin[];
  config: ResolvedBunaConfig;
  tailwindAsset?: WorkerAsset | null;
  tailwindPlugin?: BunPlugin | null;
}

export type BunBuildArtifact = Awaited<ReturnType<typeof Bun.build>>["outputs"][number];

export type WorkerDataRoute = {
  pattern: string;
  html: string;
  regex: string | null;
};

export type WorkerData = {
  routes: WorkerDataRoute[];
  htmlCacheControl: string;
  assetCacheControl: string;
  assetsBasePath: string;
};
