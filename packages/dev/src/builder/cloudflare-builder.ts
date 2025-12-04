import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename as pathBasename, dirname as pathDirname, extname as pathExtname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { BunPlugin } from "bun";
import type { ResolvedBunaConfig } from "opaca/core";

type WorkerAsset = {
  entryPath: string;
  fileName: string;
  urlPath: string;
  contentType: string;
};

type HtmlRouteRecord = {
  pattern: string;
  html: string;
  regex: string | null;
};

type ApiRouteRecord = {
  pattern: string;
  importPath: string;
  identifier: string;
};

type BuildLog = {
  message: string;
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
};

const DEFAULT_ASSET_PREFIX = "/_buna/assets";
const DEFAULT_HTML_CACHE = "public, max-age=60";
const DEFAULT_STATIC_CACHE = "public, max-age=31536000, immutable";
const API_DIR = "src/api";

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

const thisDir = pathDirname(fileURLToPath(import.meta.url));
const BUNA_SRC_DIR = resolve(thisDir, "../../../opaca/src");

interface TransformContext {
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

type BunBuildArtifact = Awaited<ReturnType<typeof Bun.build>>["outputs"][number];

export async function buildCloudflareWorker(options: CloudflareBuildOptions): Promise<CloudflareBuildResult> {
  const {
    config,
    projectRoot = process.cwd(),
    minify = true,
    assetsBasePath = DEFAULT_ASSET_PREFIX,
    outDir,
    htmlCacheControl = DEFAULT_HTML_CACHE,
    assetCacheControl = DEFAULT_STATIC_CACHE,
  } = options;

  const resolvedOutDir = resolveOutputDirectory(outDir ?? join(config.outDir, "cloudflare"), projectRoot);
  await resetDir(resolvedOutDir);
  const workerAssetsDir = join(resolvedOutDir, "assets");
  const workerPagesDir = join(resolvedOutDir, "pages");
  await ensureDir(workerAssetsDir);
  await ensureDir(workerPagesDir);

  const generatedPagesDir = join(config.outDir, "pages");
  const htmlFiles = await collectHtmlFiles(generatedPagesDir);

  if (htmlFiles.length === 0) {
    throw new Error(`Nenhuma página .html encontrada em "${generatedPagesDir}". Execute "opaca codegen" antes de gerar o worker.`);
  }

  const ctx: TransformContext = {
    projectRoot,
    minify,
    assetsBasePath: sanitizeAssetPrefix(assetsBasePath),
    assetCache: new Map(),
    assets: [],
    assetsDir: workerAssetsDir,
    plugins: [createWorkspaceResolverPlugin(), createExtensionFallbackPlugin()],
    config,
  };

  const routes: HtmlRouteRecord[] = [];

  for (const file of htmlFiles) {
    const html = await readFile(file, "utf8");
    const pattern = extractRoutePattern(html) ?? inferRouteFromFile(file, generatedPagesDir);

    if (!pattern) {
      throw new Error(`Não foi possível determinar o caminho da rota para o arquivo ${file}`);
    }

    const transformed = await transformHtmlFile(file, html, ctx);
    await emitWorkerPage(file, transformed, generatedPagesDir, workerPagesDir);
    routes.push({
      pattern,
      html: transformed,
      regex: compilePatternToRegex(pattern),
    });
  }

  const apiBaseDir = resolve(projectRoot, API_DIR);
  const apiFiles = await collectApiFiles(apiBaseDir);
  const apiRoutes: ApiRouteRecord[] = apiFiles.map((file, index) => {
    const pattern = apiFilePathToRoute(file, apiBaseDir);
    const relImport = relative(resolvedOutDir, file)
      .replace(/\\/g, "/")
      .replace(/\.(tsx|jsx|ts|js)$/, "");
    const importPath = relImport.startsWith(".") ? relImport : `./${relImport}`;
    return {
      pattern,
      importPath,
      identifier: `Api_${index}`,
    };
  });

  const workerSource = createWorkerSource({
    routes,
    htmlCacheControl,
    assetCacheControl,
    assetsBasePath: ctx.assetsBasePath,
    apiRoutes,
  });

  const workerPath = join(resolvedOutDir, "worker.js");
  await writeFile(workerPath, workerSource, "utf8");

  return { workerPath, assets: ctx.assets.length, routes: routes.length };
}

async function ensureDir(path: string) {
  await mkdir(path, { recursive: true });
}

async function resetDir(path: string) {
  await rm(path, { recursive: true, force: true }).catch(() => { });
  await mkdir(path, { recursive: true });
}

async function emitWorkerPage(sourceFile: string, html: string, sourceDir: string, targetDir: string) {
  const relativePath = relative(sourceDir, sourceFile);
  const outputFile = join(targetDir, relativePath);
  await ensureDir(pathDirname(outputFile));
  await writeFile(outputFile, html, "utf8");
}

async function collectHtmlFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await collectHtmlFiles(full)));
      } else if (entry.isFile() && entry.name.endsWith(".html")) {
        files.push(full);
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }
  return files;
}

async function collectApiFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await collectApiFiles(full)));
      } else if (entry.isFile() && /\.(tsx|ts|jsx|js)$/.test(entry.name)) {
        files.push(full);
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }
  return files;
}

function extractRoutePattern(html: string): string | null {
  const match = html.match(/data-opaca-route="([^"]+)"/);
  return match ? match[1] : null;
}

function inferRouteFromFile(filePath: string, pagesDir: string): string {
  const relativePath = relative(pagesDir, filePath).replace(/\\/g, "/");
  const withoutExt = relativePath.replace(/\.html$/, "");
  const segments = withoutExt.split("/");

  if (segments.length === 1 && segments[0] === "index") {
    return "/";
  }

  const normalizedSegments = segments
    .filter(Boolean)
    .map((segment, index, arr) =>
      index === arr.length - 1 && segment === "index"
        ? null
        : segment.startsWith("[") && segment.endsWith("]")
          ? segment.startsWith("[...")
            ? "*"
            : `:${segment.slice(1, -1)}`
          : segment,
    )
    .filter((segment): segment is string => Boolean(segment));

  if (normalizedSegments.length === 0) {
    return "/";
  }

  return `/${normalizedSegments.join("/")}`;
}

function apiFilePathToRoute(pathname: string, apiDir: string): string {
  const rel = relative(apiDir, pathname).replace(/\\/g, "/");
  const withoutExt = rel.replace(/\.(tsx|jsx|ts|js)$/, "");
  const segments = withoutExt.split("/");

  // Special-case root index route: src/api/index.ts -> /api
  if (segments.length === 1 && segments[0] === "index") {
    return "/api";
  }

  const isIndexRoute = segments[segments.length - 1] === "index";
  const coreSegments = isIndexRoute ? segments.slice(0, -1) : segments;

  const mapped = coreSegments.map(segment => {
    if (segment.startsWith("[") && segment.endsWith("]")) {
      const inner = segment.slice(1, -1);

      // Catch-all segments like "[...slug]" -> "*"
      if (inner.startsWith("...")) {
        return "*";
      }

      let optional = false;
      let nameAndPattern = inner;

      // Optional parameter: "[id?]" -> ":id?"
      if (nameAndPattern.endsWith("?")) {
        optional = true;
        nameAndPattern = nameAndPattern.slice(0, -1);
      }

      let paramName = nameAndPattern;
      let pattern: string | undefined;

      // Regex parameter: "[date{[0-9]+}]" -> ":date{[0-9]+}"
      const braceIndex = nameAndPattern.indexOf("{");
      if (braceIndex !== -1 && nameAndPattern.endsWith("}")) {
        paramName = nameAndPattern.slice(0, braceIndex);
        pattern = nameAndPattern.slice(braceIndex); // includes "{...}"
      }

      let result = `:${paramName}`;
      if (pattern) result += pattern;
      if (optional) result += "?";
      return result;
    }

    return segment;
  });

  const base = "/api";
  if (mapped.length === 0) {
    return base;
  }

  return `${base}/${mapped.join("/")}`;
}

async function transformHtmlFile(filePath: string, html: string, ctx: TransformContext): Promise<string> {
  let output = html;
  const dir = pathDirname(filePath);

  for (const script of extractScriptTags(html)) {
    if (!script.isModule || !isRelativeAsset(script.src)) {
      continue;
    }

    const entryPath = resolve(dir, script.src);
    const asset = await compileScriptAsset(entryPath, ctx);
    const newTag = `<script type="module" src="${asset.urlPath}" data-opaca-asset="true"></script>`;
    output = output.replace(script.original, newTag);
  }

  for (const sheet of extractStylesheetLinks(html)) {
    if (sheet.href === "tailwindcss") {
      const asset = await compileTailwindAsset(ctx);
      if (!asset) {
        continue;
      }
      const newTag = `<link rel="stylesheet" href="${asset.urlPath}" data-opaca-asset="true" />`;
      output = output.replace(sheet.original, newTag);
      continue;
    }

    if (!isRelativeAsset(sheet.href)) {
      continue;
    }

    const entryPath = resolve(dir, sheet.href);
    const asset = await compileCssAsset(entryPath, ctx);
    const newTag = `<link rel="stylesheet" href="${asset.urlPath}" data-opaca-asset="true" />`;
    output = output.replace(sheet.original, newTag);
  }

  for (const assetTag of extractStaticAssetTags(html)) {
    if (!isRelativeAsset(assetTag.value)) {
      continue;
    }

    const entryPath = resolve(dir, assetTag.value);
    const asset = await compileStaticAsset(entryPath, ctx);
    const attrPattern = new RegExp(
      `${assetTag.attrName}=(["'])${escapeRegex(assetTag.value)}\\1`,
      "i",
    );
    const replacedTag = assetTag.original.replace(attrPattern, `${assetTag.attrName}="${asset.urlPath}"`);
    output = output.replace(assetTag.original, replacedTag);
  }

  return output;
}

type ScriptTag = { original: string; src: string; isModule: boolean };
type StylesheetTag = { original: string; href: string };
type StaticAssetTag = { original: string; attrName: string; value: string; tagName: string };

function extractScriptTags(html: string): ScriptTag[] {
  const regex = /<script\b[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi;
  const tags: ScriptTag[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html))) {
    const original = match[0];
    const attrs = original.toLowerCase();
    const isModule = attrs.includes('type="module"') || attrs.includes("type='module'");
    tags.push({ original, src: match[1], isModule });
  }

  return tags;
}

function extractStylesheetLinks(html: string): StylesheetTag[] {
  const regex = /<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi;
  const tags: StylesheetTag[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html))) {
    const original = match[0];
    const hrefMatch = original.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    tags.push({ original, href: hrefMatch[1] });
  }

  return tags;
}

const STATIC_ASSET_ATTRS: Record<string, Set<string>> = {
  src: new Set(["img", "source", "audio", "video", "track", "iframe", "embed", "object"]),
  href: new Set(["link"]),
  poster: new Set(["video"]),
};

function extractStaticAssetTags(html: string): StaticAssetTag[] {
  const regex = /<([a-zA-Z0-9:-]+)\b[^>]*?(src|href|poster)=["']([^"']+)["'][^>]*>/gi;
  const tags: StaticAssetTag[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html))) {
    const original = match[0];
    const tagName = match[1]?.toLowerCase();
    const attrName = match[2]?.toLowerCase();
    const value = match[3];
    if (!original || !tagName || !attrName || !value) continue;

    const allowedTags = STATIC_ASSET_ATTRS[attrName];
    if (!allowedTags || !allowedTags.has(tagName)) {
      continue;
    }

    if (tagName === "link") {
      const relMatch = original.match(/rel=["']([^"']+)["']/i);
      if (relMatch && relMatch[1]?.toLowerCase() === "stylesheet") {
        continue;
      }
    }

    tags.push({ original, attrName, value, tagName });
  }

  return tags;
}

function isRelativeAsset(value: string): boolean {
  if (!value) return false;
  return value.startsWith("./") || value.startsWith("../");
}

async function compileScriptAsset(entryPath: string, ctx: TransformContext): Promise<WorkerAsset> {
  const cached = ctx.assetCache.get(entryPath);
  if (cached) return cached;

  const result = await Bun.build({
    entrypoints: [entryPath],
    target: "browser",
    format: "esm",
    splitting: false,
    minify: ctx.minify,
    plugins: ctx.plugins,
  });

  if (!result.success) {
    throw new Error(formatBuildErrors(entryPath, result.logs));
  }

  const artifact = result.outputs.find((output) => output.kind === "entry-point");

  if (!artifact) {
    throw new Error(`Bun.build não retornou artefatos para ${entryPath}`);
  }

  const contents = await artifact.text();
  const filename = `${slugify(relative(ctx.projectRoot, entryPath).replace(/\\/g, "/").replace(/\.[tj]sx?$/, ""))}-${artifact.hash}.js`;
  const urlPath = `${ctx.assetsBasePath}/${filename}`;
  await writeAssetFile(ctx, filename, contents);

  const asset: WorkerAsset = {
    entryPath,
    fileName: filename,
    urlPath,
    contentType: "text/javascript; charset=utf-8",
  };

  ctx.assetCache.set(entryPath, asset);
  ctx.assets.push(asset);

  await emitBundledAssetOutputs(result.outputs, artifact, ctx);

  return asset;
}

async function compileCssAsset(entryPath: string, ctx: TransformContext): Promise<WorkerAsset> {
  const cached = ctx.assetCache.get(entryPath);
  if (cached) return cached;

  try {
    await stat(entryPath);
  } catch (err) {
    throw new Error(`Arquivo CSS não encontrado: ${entryPath}`);
  }

  const tailwindPlugin = await ensureTailwindPlugin(ctx);
  if (tailwindPlugin) {
    const result = await Bun.build({
      entrypoints: [entryPath],
      target: "browser",
      format: "esm",
      splitting: false,
      minify: ctx.minify,
      plugins: [...ctx.plugins, tailwindPlugin],
    });

    if (!result.success) {
      throw new Error(formatBuildErrors(entryPath, result.logs));
    }

    const artifact = result.outputs.find(
      (output) => output.kind === "entry-point" || output.kind === "asset",
    );

    if (!artifact) {
      throw new Error(`Bun.build não retornou artefatos para ${entryPath}`);
    }

    const contents = await artifact.text();
    const filename = `${slugify(relative(ctx.projectRoot, entryPath).replace(/\\/g, "/").replace(/\.[cm]?css$/, ""))}-${artifact.hash}.css`;
    const urlPath = `${ctx.assetsBasePath}/${filename}`;
    await writeAssetFile(ctx, filename, contents);

    const asset: WorkerAsset = {
      entryPath,
      fileName: filename,
      urlPath,
      contentType: "text/css; charset=utf-8",
    };

    ctx.assetCache.set(entryPath, asset);
    ctx.assets.push(asset);

    await emitBundledAssetOutputs(result.outputs, artifact, ctx);

    return asset;
  }

  const contents = await readFile(entryPath, "utf8");
  const filename = `${slugify(relative(ctx.projectRoot, entryPath).replace(/\\/g, "/").replace(/\.[cm]?css$/, ""))}-${hashString(contents)}.css`;
  const urlPath = `${ctx.assetsBasePath}/${filename}`;
  await writeAssetFile(ctx, filename, contents);

  const asset: WorkerAsset = {
    entryPath,
    fileName: filename,
    urlPath,
    contentType: "text/css; charset=utf-8",
  };

  ctx.assetCache.set(entryPath, asset);
  ctx.assets.push(asset);

  return asset;
}

async function compileTailwindAsset(ctx: TransformContext): Promise<WorkerAsset | null> {
  if (ctx.tailwindAsset) {
    return ctx.tailwindAsset;
  }

  const plugin = await ensureTailwindPlugin(ctx);
  if (!plugin) {
    console.warn("⚠️  No Tailwind plugin found. Make sure to install 'bun-plugin-tailwind' in your project.");
    return null;
  }

  const entryPath = join(ctx.config.outDir, "__tailwind-entry.css");
  await ensureDir(pathDirname(entryPath));
  await writeFile(entryPath, '@import "tailwindcss";\n', "utf8");

  const result = await Bun.build({
    entrypoints: [entryPath],
    target: "browser",
    format: "esm",
    splitting: false,
    minify: ctx.minify,
    plugins: [...ctx.plugins, plugin],
  });

  if (!result.success) {
    throw new Error(formatBuildErrors("tailwindcss", result.logs));
  }

  const artifact = result.outputs.find(
    (output) => output.kind === "entry-point" || output.kind === "asset",
  );
  if (!artifact) {
    throw new Error("Falha ao gerar CSS do Tailwind");
  }

  const contents = await artifact.text();
  const filename = `tailwind-${artifact.hash}.css`;
  const urlPath = `${ctx.assetsBasePath}/${filename}`;
  await writeAssetFile(ctx, filename, contents);

  const asset: WorkerAsset = {
    entryPath: "tailwindcss",
    fileName: filename,
    urlPath,
    contentType: "text/css; charset=utf-8",
  };

  ctx.tailwindAsset = asset;
  ctx.assets.push(asset);

  await rm(entryPath).catch(() => { });

  return asset;
}

async function ensureTailwindPlugin(ctx: TransformContext): Promise<BunPlugin | null> {
  if (ctx.tailwindPlugin !== undefined) {
    return ctx.tailwindPlugin;
  }

  const plugin = await loadTailwindPluginFromProject(ctx.projectRoot);
  ctx.tailwindPlugin = plugin;
  return plugin;
}

async function loadTailwindPluginFromProject(projectRoot: string): Promise<BunPlugin | null> {
  try {
    const mod = await import("bun-plugin-tailwind");
    return (mod.default ?? mod) as BunPlugin;
  } catch {
    // fall through
  }

  const packagePath = resolve(projectRoot, "node_modules", "bun-plugin-tailwind", "package.json");
  try {
    const pkgRaw = await readFile(packagePath, "utf8");
    const pkg = JSON.parse(pkgRaw) as { module?: string; main?: string };
    const candidates = [pkg.module, pkg.main, "index.mjs", "index.js"].filter(Boolean) as string[];

    for (const candidate of candidates) {
      const candidatePath = resolve(projectRoot, "node_modules", "bun-plugin-tailwind", candidate);
      try {
        const mod = await import(pathToFileURL(candidatePath).href);
        return (mod.default ?? mod) as BunPlugin;
      } catch {
        continue;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

async function emitBundledAssetOutputs(
  outputs: BunBuildArtifact[],
  skip: BunBuildArtifact,
  ctx: TransformContext,
) {
  for (const artifact of outputs) {
    if (artifact === skip) {
      continue;
    }
    if (artifact.kind !== "asset") {
      continue;
    }

    const filename =
      artifact.path && artifact.path !== ""
        ? pathBasename(artifact.path)
        : `asset-${artifact.hash}`;
    const buffer = new Uint8Array(await artifact.arrayBuffer());
    await writeAssetFile(ctx, filename, buffer);

    const asset: WorkerAsset = {
      entryPath: artifact.path ?? filename,
      fileName: filename,
      urlPath: `${ctx.assetsBasePath}/${filename}`,
      contentType: guessContentType(pathExtname(filename)),
    };

    ctx.assets.push(asset);
  }
}

async function compileStaticAsset(entryPath: string, ctx: TransformContext): Promise<WorkerAsset> {
  const cached = ctx.assetCache.get(entryPath);
  if (cached) return cached;

  const file = Bun.file(entryPath);
  if (!(await file.exists())) {
    throw new Error(`Arquivo de asset não encontrado: ${entryPath}`);
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const relativePath = relative(ctx.projectRoot, entryPath).replace(/\\/g, "/");
  const ext = pathExtname(entryPath);
  const baseName = slugify(relativePath.replace(ext, ""));
  const filename = `${baseName}-${hashBuffer(buffer)}${ext || ""}`;
  const urlPath = `${ctx.assetsBasePath}/${filename}`;

  await writeAssetFile(ctx, filename, buffer);

  const asset: WorkerAsset = {
    entryPath,
    fileName: filename,
    urlPath,
    contentType: guessContentType(ext),
  };

  ctx.assetCache.set(entryPath, asset);
  ctx.assets.push(asset);

  return asset;
}

async function writeAssetFile(ctx: TransformContext, filename: string, contents: string | Uint8Array | Buffer) {
  const assetPath = join(ctx.assetsDir, filename);
  await ensureDir(pathDirname(assetPath));
  if (typeof contents === "string") {
    await writeFile(assetPath, contents, "utf8");
  } else {
    await writeFile(assetPath, contents);
  }
}

function hashString(value: string): string {
  const data = new TextEncoder().encode(value);
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = (hash * 31 + data[i]) >>> 0;
  }
  return hash.toString(16);
}

function hashBuffer(data: Uint8Array): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = (hash * 31 + data[i]) >>> 0;
  }
  return hash.toString(16);
}

function slugify(value: string): string {
  return value
    .replace(/\\/g, "/")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-") || "bundle";
}

function sanitizeAssetPrefix(prefix: string): string {
  if (!prefix.startsWith("/")) {
    prefix = `/${prefix}`;
  }
  return prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
}

function resolveOutputDirectory(dir: string, cwd: string): string {
  return isAbsolute(dir) ? dir : resolve(cwd, dir);
}

function guessContentType(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    case ".avif":
      return "image/avif";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".mp3":
      return "audio/mpeg";
    case ".ogg":
      return "audio/ogg";
    case ".json":
      return "application/json";
    default:
      return "application/octet-stream";
  }
}

function compilePatternToRegex(pattern: string): string | null {
  if (!pattern || pattern === "/") {
    return null;
  }

  if (!pattern.includes(":") && !pattern.includes("*")) {
    return null;
  }

  const segments = pattern.split("/").filter(Boolean);
  const parts = segments.map((segment) => {
    if (segment === "*") {
      return "(.*)";
    }
    if (segment.startsWith(":")) {
      return "([^/]+)";
    }
    return escapeRegex(segment);
  });

  return `^/${parts.join("/")}` + "$";
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createWorkerSource(params: {
  routes: HtmlRouteRecord[];
  htmlCacheControl: string;
  assetCacheControl: string;
  assetsBasePath: string;
  apiRoutes: ApiRouteRecord[];
}): string {
  const apiImports = params.apiRoutes
    .map(route => `import * as ${route.identifier} from "${route.importPath}";`)
    .join("\n");

  const apiRouteEntries = params.apiRoutes
    .map(
      route =>
        `{ pattern: ${JSON.stringify(route.pattern)}, module: normalizeApiModule(${route.identifier}) }`,
    )
    .join(",\n  ");

  const apiSection =
    params.apiRoutes.length > 0
      ? `
${apiImports}

function normalizeApiModule(mod) {
  if (mod && (typeof mod.default === "function" || typeof mod.default === "object")) {
    return mod.default;
  }

  const route = {};
  const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

  for (const method of METHODS) {
    const handler = mod[method];
    if (typeof handler === "function") {
      route[method] = handler;
    }
  }

  return route;
}

const API_ROUTES = [
  ${apiRouteEntries}
];

function matchApiRoute(pathname, method) {
  if (!pathname.startsWith("/api")) {
    return null;
  }

  for (const route of API_ROUTES) {
    const params = matchPatternWithParams(route.pattern, pathname);
    if (!params) continue;

    const handler = route.module[method];
    if (typeof handler !== "function") continue;

    return { handler, params };
  }

  return null;
}

function matchPatternWithParams(pattern, pathname) {
  if (!pattern) {
    return null;
  }

  if (pattern === pathname) {
    return {};
  }

  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);

  const params = {};
  let i = 0;
  let j = 0;

  while (i < patternSegments.length && j < pathSegments.length) {
    const p = patternSegments[i];
    const s = pathSegments[j];

    if (p === "*") {
      params["*"] = pathSegments.slice(j).join("/");
      return params;
    }

    if (p.startsWith(":")) {
      let token = p.slice(1);
      let optional = false;

      if (token.endsWith("?")) {
        optional = true;
        token = token.slice(0, -1);
      }

      let name = token;
      let patternSource = null;
      const braceIndex = token.indexOf("{");
      if (braceIndex !== -1 && token.endsWith("}")) {
        name = token.slice(0, braceIndex);
        patternSource = token.slice(braceIndex + 1, -1);
      }

      if (patternSource) {
        const re = new RegExp(patternSource);
        if (!re.test(s)) {
          return null;
        }
      }

      params[name] = s;
      i++;
      j++;
      continue;
    }

    if (p !== s) {
      return null;
    }

    i++;
    j++;
  }

  while (i < patternSegments.length) {
    const p = patternSegments[i];
    if (p === "*") {
      params["*"] = "";
      i++;
      continue;
    }
    if (p.startsWith(":") && p.endsWith("?")) {
      i++;
      continue;
    }
    return null;
  }

  if (j < pathSegments.length) {
    return null;
  }

  return params;
}
`
      : `
const API_ROUTES = [];
function matchApiRoute() {
  return null;
}
function matchPatternWithParams() {
  return null;
}
`;

  const routeEntries = params.routes
    .map((route) => {
      const matcher = route.regex ? `new RegExp(${JSON.stringify(route.regex)})` : "null";
      return `{ pattern: ${JSON.stringify(route.pattern)}, html: ${JSON.stringify(route.html)}, matcher: ${matcher} }`;
    })
    .join(",\n  ");

  return `// GENERATED BY opaca cloudflare builder
${apiSection}
const HTML_ROUTES = [
  ${routeEntries}
];

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": ${JSON.stringify(params.htmlCacheControl)},
};

const ASSET_CACHE_HEADER = ${JSON.stringify(params.assetCacheControl)};
const ASSET_PREFIX = ${JSON.stringify(params.assetsBasePath)};
const ASSET_BINDING_KEY = "ASSETS";

function normalizePath(pathname) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function matchHtmlRoute(pathname) {
  for (const route of HTML_ROUTES) {
    if (route.pattern === pathname) {
      return route;
    }
    if (route.matcher && route.matcher.test(pathname)) {
      return route;
    }
  }
  return null;
}

async function maybeServeBoundAsset(request, env) {
  const assetBinding = env?.[ASSET_BINDING_KEY];
  if (!assetBinding) {
    return null;
  }

  const url = new URL(request.url);
  if (!url.pathname.startsWith(ASSET_PREFIX)) {
    return null;
  }

  const relativePath = url.pathname.slice(ASSET_PREFIX.length) || "/";
  const assetPath = relativePath.startsWith("/") ? relativePath : \`/\${relativePath}\`;
  const assetUrl = new URL(request.url);
  assetUrl.pathname = assetPath;
  assetUrl.search = "";
  assetUrl.hash = "";

  const assetRequest = new Request(assetUrl.toString(), request);
  const response = await assetBinding.fetch(assetRequest);
  if (!response || response.status === 404) {
    return null;
  }

  const headers = new Headers(response.headers);
  if (ASSET_CACHE_HEADER) {
    headers.set("cache-control", ASSET_CACHE_HEADER);
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const normalized = normalizePath(url.pathname);

    const assetResponse = await maybeServeBoundAsset(request, env);
    if (assetResponse) {
      return assetResponse;
    }

    const apiMatch = matchApiRoute(normalized, request.method.toUpperCase());
    if (apiMatch) {
      const { handler, params } = apiMatch;
      const apiRequest = new Request(request);
      apiRequest.params = params;
      return handler(apiRequest);
    }

    const route = matchHtmlRoute(normalized);
    if (route) {
      return new Response(route.html, { headers: HTML_HEADERS });
    }

    return new Response("Not Found", { status: 404 });
  },
};
`;
}

function formatBuildErrors(entryPath: string, logs?: BuildLog[]): string {
  if (!logs || logs.length === 0) {
    return `Falha ao compilar ${entryPath}`;
  }
  const formatted = logs
    .map((log) => {
      const location = log.location ? `${log.location.file}:${log.location.line}:${log.location.column}` : entryPath;
      return `${location}\n${log.message}`;
    })
    .join("\n\n");
  return `Falha ao compilar ${entryPath}:\n${formatted}`;
}

export function createWorkspaceResolverPlugin(): BunPlugin {
  return {
    name: "opaca-workspace-resolver",
    setup(build) {
      build.onResolve({ filter: /^opaca(\/.*)?$/ }, (args) => {
        const subpath = args.path === "opaca" ? "" : args.path.replace(/^opaca\//, "");
        const resolved = subpath ? join(BUNA_SRC_DIR, subpath) : join(BUNA_SRC_DIR, "index.ts");
        return { path: resolved };
      });
    },
  };
}

export function createExtensionFallbackPlugin(): BunPlugin {
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
  return {
    name: "extension-fallback",
    setup(build) {
      build.onResolve({ filter: /^\./ }, async (args) => {
        const hasKnownExtension = extensions.some((ext) => args.path.endsWith(ext));
        if (hasKnownExtension) {
          return null;
        }

        const abs = resolve(args.resolveDir, args.path);
        const candidates = [
          abs,
          ...extensions.map((ext) => abs + ext),
          ...extensions.map((ext) => join(abs, `index${ext}`)),
        ];

        for (const candidate of candidates) {
          if (await Bun.file(candidate).exists()) {
            return { path: candidate };
          }
        }

        return null;
      });
    },
  };
}

export function createHtmlStubPlugin(): BunPlugin {
  return {
    name: "html-stub",
    setup(build) {
      build.onLoad({ filter: /\.html$/ }, () => ({
        contents: "export default {};",
        loader: "js",
      }));
    },
  };
}
