#!/usr/bin/env bun
import plugin from "bun-plugin-tailwind";
import { existsSync } from "node:fs";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import type { BunaConfig, ResolvedBunaConfig } from "opaca/core";
import { defineConfig } from "opaca/core";
import { generateRoutes } from "../codegen/generate-routes";
import { buildCloudflareWorker } from "../builder/cloudflare-builder";

type BunBuildTarget = Exclude<Bun.BuildConfig["target"], undefined>;

export type BuildRuntime = "cloudflare" | "node" | "bun";

interface BuildPreset {
  target: BunBuildTarget;
  outDir: string;
  label: string;
  hint: string;
}

export const BUILD_RUNTIME_PRESETS: Record<BuildRuntime, BuildPreset> = {
  bun: {
    target: "bun",
    outDir: "dist/bun",
    label: "Bun",
    hint: "dist/bun",
  },
  node: {
    target: "node",
    outDir: "dist/node",
    label: "Node.js",
    hint: "dist/node",
  },
  cloudflare: {
    target: "browser",
    outDir: ".opaca/cloudflare",
    label: "Cloudflare Worker",
    hint: ".opaca/cloudflare",
  },
};

export function isBuildRuntime(value: string | undefined | null): value is BuildRuntime {
  if (!value) return false;
  return (Object.keys(BUILD_RUNTIME_PRESETS) as BuildRuntime[]).includes(
    value.toLowerCase() as BuildRuntime
  );
}

const HELP_TEXT = `
🏗️  Opaca Build Script

Usage: bun run build.ts [options]

Common Options:
  --runtime <target>      Runtime preset to use (bun|node|cloudflare)
  --outdir <path>         Output directory (default varies per runtime)
  --minify                Enable minification (or --no-minify to disable)
  --sourcemap <type>      Sourcemap type: none|linked|inline|external
  --target <target>       Build target: browser|bun|node
  --format <format>       Output format: esm|cjs|iife
  --splitting             Enable code splitting
  --packages <type>       Package handling: bundle|external
  --public-path <path>    Public path for assets
  --env <mode>            Environment handling: inline|disable|prefix*
  --conditions <list>     Package.json export conditions (comma separated)
  --external <list>       External packages (comma separated)
  --banner <text>         Add banner text to output
  --footer <text>         Add footer text to output
  --define.<key>=value    Define global constants (e.g. --define.VERSION=1.0.0)
  --help, -h              Show this help message

Examples:
  bun run build.ts --runtime=bun
  bun run build.ts --runtime=cloudflare --outdir=dist/cf
`;

type CliBuildConfig = Partial<Bun.BuildConfig> & Record<string, unknown>;

const HELP_FLAGS = new Set(["--help", "-h"]);

function parseArgs(argv: string[]): CliBuildConfig {
  const config: CliBuildConfig = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg?.startsWith("--")) continue;

    if (arg.startsWith("--no-")) {
      const key = toCamelCase(arg.slice(5));
      config[key] = false;
      continue;
    }

    if (!arg.includes("=") && (i === argv.length - 1 || argv[i + 1]?.startsWith("--"))) {
      const key = toCamelCase(arg.slice(2));
      config[key] = true;
      continue;
    }

    let key: string;
    let value: string;

    if (arg.includes("=")) {
      [key, value] = arg.slice(2).split("=", 2) as [string, string];
    } else {
      key = arg.slice(2);
      value = argv[++i] ?? "";
    }

    key = toCamelCase(key);

    if (key.includes(".")) {
      const [parentKey, childKey] = key.split(".", 2);
      if (!parentKey || !childKey) {
        continue;
      }

      if (
        typeof config[parentKey] !== "object" ||
        config[parentKey] === null ||
        Array.isArray(config[parentKey])
      ) {
        config[parentKey] = {};
      }

      (config[parentKey] as Record<string, unknown>)[childKey] = parseValue(value);
      continue;
    } else {
      config[key] = parseValue(value);
    }
  }

  return config;
}

function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_match, letter: string) => (letter ?? "").toUpperCase());
}

const NUMBER_RE = /^\d+(\.\d+)?$/;

function parseValue(value: string): any {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (NUMBER_RE.test(value)) return parseFloat(value);
  if (value.includes(",")) return value.split(",").map(v => v.trim());
  return value;
}

const SIZE_UNITS = ["B", "KB", "MB", "GB"];

const DEFAULT_SERVER_ENTRY = "src/entry.ts";

const BUILD_SUMMARY_HEADER = ["file", "type", "size"] as const;

const BUNA_BUILD_LOG_PREFIX = "[opaca build]";

async function loadBunaConfigFromFile(
  configFile: string,
  cwd: string
): Promise<ResolvedBunaConfig> {
  const resolvedPath = path.resolve(cwd, configFile);
  const build = await Bun.build({
    entrypoints: [resolvedPath],
    target: "bun",
    format: "esm",
    splitting: false,
  });

  if (!build.success) {
    const logs = build.logs?.map(log => log.message).join("\n");
    throw new Error(
      logs || `Não foi possível compilar a configuração "${configFile}".`
    );
  }

  const artifact = build.outputs.find(output => output.kind === "entry-point");
  if (!artifact) {
    throw new Error(`Bun.build não retornou saída para "${configFile}".`);
  }

  const code = await artifact.text();
  const tempDir = await mkdtemp(path.join(tmpdir(), "opaca-config-"));
  const tempFile = path.join(tempDir, "config.mjs");
  await writeFile(tempFile, code, "utf8");

  try {
    const mod = await import(pathToFileURL(tempFile).href);
    const raw = (mod.default ?? mod.config) as
      | BunaConfig
      | ResolvedBunaConfig
      | undefined;

    if (!raw) {
      throw new Error(`File "${configFile}" does'nt export any configuration.`);
    }

    if ("routesDir" in raw && "outDir" in raw) {
      return raw as ResolvedBunaConfig;
    }

    return defineConfig(raw as BunaConfig);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => { });
  }
}

function formatFileSize(bytes: number): string {
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < SIZE_UNITS.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${SIZE_UNITS[unitIndex]}`;
}

export interface BunaBuildSummary {
  runtime: BuildRuntime;
  outdir: string;
  entryCount: number;
  ms: number;
  outputs: Array<{ file: string; type: string; size: string }>;
}

export interface BunaBuildOptions {
  runtime?: BuildRuntime;
  cwd?: string;
  argv?: string[];
  silent?: boolean;
}

export async function runBunaBuild(
  options: BunaBuildOptions = {}
): Promise<BunaBuildSummary | null> {
  const argv = options.argv ?? [];
  if (argv.some(arg => HELP_FLAGS.has(arg))) {
    console.log(HELP_TEXT);
    return null;
  }

  const parsed = parseArgs(argv);
  let runtime = options.runtime;

  if (!runtime && typeof parsed.runtime === "string") {
    const normalized = parsed.runtime.toLowerCase();
    if (isBuildRuntime(normalized)) {
      runtime = normalized;
    }
    delete parsed.runtime;
  }

  if (!runtime && process.env.BUNA_RUNTIME_TARGET) {
    const normalized = process.env.BUNA_RUNTIME_TARGET.toLowerCase();
    if (isBuildRuntime(normalized)) {
      runtime = normalized;
    }
  }

  const selectedRuntime = runtime ?? "bun";
  const preset = BUILD_RUNTIME_PRESETS[selectedRuntime];
  const workingDir = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const previousCwd = process.cwd();

  if (previousCwd !== workingDir) {
    process.chdir(workingDir);
  }

  try {
    const buildConfig: CliBuildConfig = { ...parsed };
    const outdir = path.resolve(
      (buildConfig.outdir as string | undefined) ?? preset.outDir
    );
    const target =
      (buildConfig.target as Bun.BuildConfig["target"] | undefined) ?? preset.target;

    buildConfig.outdir = outdir;
    buildConfig.target = target;

    const define =
      (buildConfig.define as Record<string, string> | undefined) ?? Object.create(null);
    buildConfig.define = {
      "process.env.NODE_ENV": JSON.stringify("production"),
      ...define,
    };

    if (!options.silent) {
      console.log(
        `\n${BUNA_BUILD_LOG_PREFIX} Starting ${selectedRuntime} build in ${workingDir}\n`
      );
    }

    if (selectedRuntime === "cloudflare") {
      const summary = await buildForCloudflare({
        buildConfig,
        workingDir,
        quiet: options.silent ?? false,
      });

      return summary;
    }

    if (existsSync(outdir)) {
      if (!options.silent) {
        console.log(`${BUNA_BUILD_LOG_PREFIX} Cleaning previous build at ${outdir}`);
      }
      await rm(outdir, { recursive: true, force: true });
    }

    let entrypoints = [...new Bun.Glob("**/*.html").scanSync("src")]
      .map(entry => path.resolve("src", entry))
      .filter(file => !file.includes("node_modules"));

    if (entrypoints.length === 0 && existsSync(DEFAULT_SERVER_ENTRY)) {
      entrypoints = [path.resolve(DEFAULT_SERVER_ENTRY)];
      if (!options.silent) {
        console.log(
          `${BUNA_BUILD_LOG_PREFIX} No HTML entrypoints found, using ${DEFAULT_SERVER_ENTRY}`
        );
      }
    }

    if (entrypoints.length === 0) {
      throw new Error(
        `${BUNA_BUILD_LOG_PREFIX} Could not find HTML files or ${DEFAULT_SERVER_ENTRY} to build.`
      );
    }

    if (!options.silent) {
      console.log(
        `${BUNA_BUILD_LOG_PREFIX} Found ${entrypoints.length} entrypoint${entrypoints.length > 1 ? "s" : ""
        }\n`
      );
    }

    const start = performance.now();
    const result = await Bun.build({
      entrypoints,
      plugins: [plugin],
      minify: (buildConfig.minify as boolean | undefined) ?? true,
      sourcemap: buildConfig.sourcemap ?? "linked",
      ...buildConfig,
    });
    const end = performance.now();

    const outputs = result.outputs.map(output => ({
      file: path.relative(workingDir, output.path),
      type: output.kind,
      size: formatFileSize(output.size),
    }));

    if (!options.silent) {
      console.table(outputs, BUILD_SUMMARY_HEADER);
      console.log(
        `\n${BUNA_BUILD_LOG_PREFIX} Completed in ${(end - start).toFixed(
          2
        )}ms (target: ${selectedRuntime})\n`
      );
    }

    return {
      runtime: selectedRuntime,
      outdir,
      entryCount: entrypoints.length,
      ms: end - start,
      outputs,
    };
  } finally {
    if (previousCwd !== workingDir) {
      process.chdir(previousCwd);
    }
  }
}

if (import.meta.main) {
  runBunaBuild({ argv: process.argv.slice(2) }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

interface CloudflareBuildContext {
  buildConfig: CliBuildConfig;
  workingDir: string;
  quiet: boolean;
}

async function buildForCloudflare({
  buildConfig,
  workingDir,
  quiet,
}: CloudflareBuildContext): Promise<BunaBuildSummary> {
  const configFile =
    typeof buildConfig.config === "string"
      ? (buildConfig.config as string)
      : "opaca.config.ts";
  delete buildConfig.config;

  const skipCodegen = Boolean(buildConfig.skipCodegen);
  delete buildConfig.skipCodegen;

  const assetsBasePath =
    typeof buildConfig.assetsBasePath === "string"
      ? (buildConfig.assetsBasePath as string)
      : undefined;
  delete buildConfig.assetsBasePath;

  const htmlCacheControl =
    typeof buildConfig.htmlCacheControl === "string"
      ? (buildConfig.htmlCacheControl as string)
      : undefined;
  delete buildConfig.htmlCacheControl;

  const assetCacheControl =
    typeof buildConfig.assetCacheControl === "string"
      ? (buildConfig.assetCacheControl as string)
      : undefined;
  delete buildConfig.assetCacheControl;

  const outdir = buildConfig.outdir as string;

  const start = performance.now();
  const config = await loadBunaConfigFromFile(configFile, workingDir);

  if (!skipCodegen) {
    await generateRoutes(config);
  }

  const result = await buildCloudflareWorker({
    config,
    outDir: outdir,
    assetsBasePath,
    projectRoot: workingDir,
    minify: buildConfig.minify !== false,
    htmlCacheControl,
    assetCacheControl,
  });

  const workerStat = await stat(result.workerPath).catch(() => null);
  const outputs = [
    {
      file: path.relative(workingDir, result.workerPath),
      type: "cf-worker",
      size: workerStat ? formatFileSize(workerStat.size) : "unknown",
    },
  ];

  const end = performance.now();

  if (!quiet) {
    console.table(outputs, BUILD_SUMMARY_HEADER);
    console.log(
      `\n${BUNA_BUILD_LOG_PREFIX} Cloudflare worker ready with ${result.routes} routes and ${result.assets} assets.\n`
    );
  }

  return {
    runtime: "cloudflare",
    outdir,
    entryCount: result.routes,
    ms: end - start,
    outputs,
  };
}
