#!/usr/bin/env bun
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { BunaConfig, ResolvedBunaConfig } from "opaca/core";
import { generateRoutes } from "../../codegen/generate-routes";
import {
  buildCloudflareWorker,
  createExtensionFallbackPlugin,
  createHtmlStubPlugin,
  createWorkspaceResolverPlugin,
} from "./index";

interface CliOptions {
  configFile: string;
  outDir?: string;
  assetsBasePath?: string;
  skipCodegen?: boolean;
  dev?: boolean;
  htmlCacheControl?: string;
  assetCacheControl?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    configFile: "opaca.config.ts",
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--config":
        options.configFile = argv[i + 1] ?? options.configFile;
        i++;
        break;
      case "--out":
        options.outDir = argv[i + 1];
        i++;
        break;
      case "--assets-base":
        options.assetsBasePath = argv[i + 1];
        i++;
        break;
      case "--skip-codegen":
        options.skipCodegen = true;
        break;
      case "--dev":
        options.dev = true;
        break;
      case "--html-cache":
        options.htmlCacheControl = argv[i + 1];
        i++;
        break;
      case "--asset-cache":
        options.assetCacheControl = argv[i + 1];
        i++;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        if (arg?.startsWith("-")) {
          console.warn(`⚠️  Flag desconhecida: ${arg}`);
        }
        break;
    }
  }

  if (options.dev) {
    options.htmlCacheControl ??= "no-store";
    options.assetCacheControl ??= "public, max-age=0";
  }

  return options;
}

async function loadConfig(configFile: string): Promise<ResolvedBunaConfig> {
  const resolvedPath = resolve(process.cwd(), configFile);
  const build = await Bun.build({
    entrypoints: [resolvedPath],
    target: "bun",
    format: "esm",
    splitting: false,
    plugins: [createWorkspaceResolverPlugin(), createExtensionFallbackPlugin(), createHtmlStubPlugin()],
  });

  if (!build.success) {
    const message =
      build.logs?.map((log) => log.message).join("\n") ??
      `Não foi possível compilar ${configFile}`;
    throw new Error(message);
  }

  const artifact = build.outputs.find((output) => output.kind === "entry-point");
  if (!artifact) {
    throw new Error(`Bun.build não retornou saída para ${configFile}`);
  }

  const code = await artifact.text();
  const tempDir = await mkdtemp(join(tmpdir(), "opaca-cloudflare-"));
  const tempFile = join(tempDir, "config.mjs");
  await writeFile(tempFile, code, "utf8");

  try {
    const mod = await import(pathToFileURL(tempFile).href);
    const config = (mod.default ?? mod.config) as BunaConfig | ResolvedBunaConfig | undefined;

    if (!config) {
      throw new Error(`Configuração não encontrada em ${configFile}`);
    }

    return config as ResolvedBunaConfig;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function printHelp() {
  console.log(`Uso: bun run packages/opaca-dev/src/builder/cloudflare-cli.ts [opções]

Opções:
  --config <arquivo>        Caminho para o arquivo opaca.config.ts (padrão: opaca.config.ts)
  --out <dir>               Diretório de saída do worker (padrão: <outDir>/cloudflare)
  --assets-base <path>      Prefixo público para assets estáticos (padrão: /_buna/assets)
  --skip-codegen            Não executa o generateRoutes antes do build
  --dev                     Build em modo desenvolvimento (sem minificação e sem cache)
  --html-cache <valor>      Cache-Control personalizado para rotas HTML
  --asset-cache <valor>     Cache-Control personalizado para assets
  --help                    Mostra esta mensagem
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = await loadConfig(options.configFile);

  if (!options.skipCodegen) {
    await generateRoutes(config);
  }

  const result = await buildCloudflareWorker({
    config,
    outDir: options.outDir,
    assetsBasePath: options.assetsBasePath,
    minify: !options.dev,
    htmlCacheControl: options.htmlCacheControl,
    assetCacheControl: options.assetCacheControl,
    projectRoot: process.cwd(),
  });

  console.log("☁️  Cloudflare worker ready!");
  console.log(`   → File: ${result.workerPath}`);
  console.log(`   → HTML Routes: ${result.routes}`);
  console.log(`   → STATIC ASSETS: ${result.assets}`);
}

main().catch((err) => {
  console.error("Error while trying to generate Worker:");
  console.error(err);
  process.exit(1);
});
