import { existsSync, watch } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { ResolvedBunaConfig } from "opaca/core";
import { generateRoutes } from "opaca-dev";
import { loadConfig } from "../utils/load-config";
import type { CommandContext } from "../types";
import { BUILD_RUNNER_TEMPLATE } from "../templates/build-runner-template";

export interface PipelineContext extends CommandContext {
  watchMode?: boolean;
  clean?: boolean;
  verbose?: boolean;
}

export interface PrepareResult {
  config: ResolvedBunaConfig;
  projectRoot: string;
  pagesDir: string;
  outDir: string;
}

export interface AnalysisResult {
  routeCount: number;
  apiCount: number;
  routesDir: string;
  config: ResolvedBunaConfig;
}

export interface Diagnostic {
  severity: "info" | "warning" | "error";
  message: string;
}

export interface GenerationPipeline {
  prepare(ctx: PipelineContext): Promise<PrepareResult>;
  analyze(ctx: PipelineContext, prepareResult: PrepareResult): Promise<AnalysisResult>;
  generate(ctx: PipelineContext, analysisResult: AnalysisResult): Promise<void>;
  diagnostics?(ctx: PipelineContext, analysisResult: AnalysisResult): Promise<Diagnostic[]>;
}

const WATCH_DEBOUNCE_MS = 200;

const generationPipeline: GenerationPipeline = {
  async prepare(ctx) {
    const config = await loadConfig(ctx.configFile);
    const projectRoot = ctx.cwd;
    const outDir = config.outDir;
    const pagesDir = join(outDir, "pages");
    if (ctx.clean && existsSync(outDir)) {
      await rm(outDir, { recursive: true, force: true }).catch(() => {});
    }

    await mkdir(pagesDir, { recursive: true });
    await ensureBuildRunner(projectRoot, outDir);
    return { config, projectRoot, pagesDir, outDir };
  },

  async analyze(ctx, prepareResult) {
    const routesDir = prepareResult.config.routesDir;
    const files = await countFiles(routesDir);
    const apiDir = join(ctx.cwd, "src", "api");
    const apiCount = await countFiles(apiDir);
    return {
      routeCount: files,
      apiCount,
      routesDir,
      config: prepareResult.config,
    };
  },

  async generate(_, analysis) {
    await generateRoutes(analysis.config);
  },

  async diagnostics(_, analysis) {
    const diagnostics: Diagnostic[] = [];
    if (analysis.routeCount === 0) {
      diagnostics.push({
        severity: "warning",
        message: `No routes were found in ${analysis.routesDir}.`,
      });
    }
    return diagnostics;
  },
};

export async function runGenerationPipeline(ctx: PipelineContext) {
  const prepared = await generationPipeline.prepare(ctx);
  const analysis = await generationPipeline.analyze(ctx, prepared);
  await generationPipeline.generate(ctx, analysis);

  if (generationPipeline.diagnostics) {
    const diagnostics = await generationPipeline.diagnostics(ctx, analysis);
    diagnostics.forEach(diagnostic => {
      console.log(`[opaca pipeline] ${diagnostic.severity.toUpperCase()}: ${diagnostic.message}`);
    });
  }

  if (ctx.watchMode) {
    const pathsToWatch = getWatchTargets(ctx, prepared, analysis);
    if (pathsToWatch.length === 0) {
      console.log("[opaca pipeline] No watch targets available.");
      return;
    }
    console.log(`[opaca pipeline] Watching ${pathsToWatch.join(", ")}`);
    await watchAndRebuild(pathsToWatch, async () => {
      const nextAnalysis = await generationPipeline.analyze(ctx, prepared);
      await generationPipeline.generate(ctx, nextAnalysis);
      if (generationPipeline.diagnostics) {
        const diagnostics = await generationPipeline.diagnostics(ctx, nextAnalysis);
        diagnostics.forEach(diagnostic => {
          console.log(`[opaca pipeline] ${diagnostic.severity.toUpperCase()}: ${diagnostic.message}`);
        });
      }
    });
  }
}

async function countFiles(target: string): Promise<number> {
  if (!existsSync(target)) {
    return 0;
  }

  const entries = await readdir(target, { withFileTypes: true });
  let total = 0;

  for (const entry of entries) {
    const fullPath = join(target, entry.name);
    if (entry.isDirectory()) {
      total += await countFiles(fullPath);
    } else if (entry.isFile()) {
      total += 1;
    }
  }

  return total;
}

async function ensureBuildRunner(projectRoot: string, outDir: string) {
  const target = join(outDir, "build.ts");
  await writeFile(target, BUILD_RUNNER_TEMPLATE, "utf8");
}

function getWatchTargets(
  ctx: PipelineContext,
  prepareResult: PrepareResult,
  analysis: AnalysisResult
): string[] {
  const targets = new Set<string>();
  targets.add(analysis.routesDir);
  targets.add(resolve(ctx.cwd, ctx.configFile));
  const apiDir = join(ctx.cwd, "src", "api");
  targets.add(apiDir);
  if (existsSync(prepareResult.pagesDir)) {
    targets.add(prepareResult.pagesDir);
  }
  return Array.from(targets).filter(path => existsSync(path));
}

async function watchAndRebuild(paths: string[], handler: () => Promise<void>) {
  const watchers: ReturnType<typeof watch>[] = [];
  let scheduled = false;

  const runHandler = async () => {
    if (scheduled) return;
    scheduled = true;
    try {
      await handler();
    } finally {
      scheduled = false;
    }
  };

  for (const path of paths) {
    try {
      const watcher = watch(path, { recursive: true }, () => {
        setTimeout(runHandler, WATCH_DEBOUNCE_MS);
      });
      watchers.push(watcher);
    } catch {
      // best effort
    }
  }

  await new Promise<void>(resolve => {
    let finished = false;
    const stop = () => {
      if (finished) return;
      finished = true;
      watchers.forEach(watcher => watcher.close());
      resolve();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}
