import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { CSS_ENTRY_PATH, FAVICON_ENTRY_PATH, ROOT_LAYOUT_ENTRY_PATH } from "./constants";
import { ResolvedBunaConfig } from "opaca";

const LAYOUT_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];
const API_DIR = "src/api";

async function ensureDir(path: string) {
  await mkdir(path, { recursive: true });
}

async function getFilesRecursively(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getFilesRecursively(fullPath)));
    } else if (
      entry.isFile() &&
      /\.(tsx|jsx|ts|js)$/.test(entry.name) &&
      !/^layout\.(tsx|ts|jsx|js)$/.test(entry.name)
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function filePathToRoute(pathname: string, routesDir: string): string {
  const rel = relative(routesDir, pathname).replace(/\\/g, "/");
  const withoutExt = rel.replace(/\.(tsx|jsx|ts|js)$/, "");
  const segments = withoutExt.split("/");

  // Special-case root index route
  if (segments.length === 1 && segments[0] === "index") {
    return "/";
  }

  // Treat "*/index" as the directory route (including dynamic segments)
  const isIndexRoute = segments[segments.length - 1] === "index";
  const coreSegments = isIndexRoute ? segments.slice(0, -1) : segments;

  const mapped = coreSegments.map(segment => {
    if (segment.startsWith("[") && segment.endsWith("]")) {
      const inner = segment.slice(1, -1);

      // Support catch-all segments like "[...slug]" -> "*"
      if (inner.startsWith("...")) {
        return "*";
      }

      // "[id]" -> ":id"
      return ":" + inner;
    }

    return segment;
  });

  // If everything collapsed (e.g. "index" only), this is "/"
  if (mapped.length === 0) {
    return "/";
  }

  return "/" + mapped.join("/");
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

export async function generateRoutes(config: ResolvedBunaConfig) {
  const { routesDir, outDir } = config;

  const projectRoot = process.cwd();
  const pagesDir = join(outDir, "pages");
  const rootLayoutPath = await findLayoutFile(join(projectRoot, ROOT_LAYOUT_ENTRY_PATH));
  const layoutCache = new Map<string, string | null>();

  // Absolute path to main CSS entry
  const cssEntryPath = join(projectRoot, CSS_ENTRY_PATH);
  const hasGlobalCssEntry = await fileExists(cssEntryPath);
  const faviconPath = join(projectRoot, "public", FAVICON_ENTRY_PATH);
  const hasFavicon = await fileExists(faviconPath);

  if (!hasFavicon) {
    // TODO: add to healthy tab inside devtools?
    console.warn(
      '[opaca codegen] File "public/favicon.ico" not found. Add it to define the route`s favicon ',
    );
  }

  await ensureDir(pagesDir);

  const files = await getFilesRecursively(routesDir);

  let imports = "";
  let apiHelpers = "";
  let apiRouteInit = "";
  let routesObject = "export const routes = {\n";

  for (const [index, file] of files.entries()) {
    // 1. HTTP route
    const routePath = filePathToRoute(file, routesDir);

    // 2. HTML file name
    const relFromRoutes = relative(routesDir, file)
      .replace(/\\/g, "/")
      .replace(/\.(tsx|jsx|ts|js)$/, "");

    const htmlRelPath = `${relFromRoutes}.html`;
    const htmlDiskPath = join(pagesDir, htmlRelPath);

    const entryRelPath = `${relFromRoutes}.entry.ts`;
    const entryDiskPath = join(pagesDir, entryRelPath);

    const layoutChain = await resolveLayoutChainForRoute({
      filePath: file,
      routesDir,
      rootLayoutPath,
      cache: layoutCache,
    });

    const routeImportPath = relative(dirname(entryDiskPath), file).replace(/\\/g, "/");
    await writeRouteEntryModule({
      entryDiskPath,
      layoutPaths: layoutChain,
      routeImportPath,
      routePath,
    });

    // 3. script src relative to HTML
    const scriptSrc = toRelativeAssetPath(
      relative(dirname(htmlDiskPath), entryDiskPath).replace(/\\/g, "/"),
    );

    // 4. css href relative to HTML (dynamic)
    const cssHref = hasGlobalCssEntry
      ? toRelativeAssetPath(
        relative(dirname(htmlDiskPath), cssEntryPath).replace(/\\/g, "/"),
      )
      : null;

    // this is generates for workers runtime to use it in each page
    const cssTag = cssHref ? `    <link rel="stylesheet" href="${cssHref}" />\n` : "";
    const faviconHref = hasFavicon
      ? toRelativeAssetPath(
        relative(dirname(htmlDiskPath), faviconPath).replace(/\\/g, "/"),
      )
      : null;
    const faviconTag = faviconHref ? `    <link rel="icon" href="${faviconHref}" />\n` : "";

    const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <title>${routePath}</title>
    ${cssTag}${faviconTag}
  </head>
  <body data-opaca-route="${routePath}">
    <div id="root"></div>
    <script type="module" src="${scriptSrc}"></script>
  </body>
</html>
`;

    await ensureDir(dirname(htmlDiskPath));
    await writeFile(htmlDiskPath, htmlContent, "utf8");

    const importVar = `Page_${index}`;
    const importPathForTs = `./pages/${htmlRelPath}`;

    imports += `import ${importVar} from "${importPathForTs}";\n`;
    routesObject += `  "${routePath}": ${importVar},\n`;
  }

  // API routes: map files under src/api to Bun/Hono-style route patterns
  const apiDir = API_DIR;
  let apiFiles: string[] = [];
  try {
    apiFiles = await getFilesRecursively(apiDir);
  } catch {
    apiFiles = [];
  }

  if (apiFiles.length > 0) {
    apiHelpers = `
function __bunaToApiRoute(mod: any): any {
  if (mod && (typeof mod.default === "function" || typeof mod.default === "object")) {
    return mod.default as any;
  }

  const route: Record<string, any> = {};
  const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"] as const;

  for (const method of METHODS) {
    const handler = (mod as any)[method];
    if (typeof handler === "function") {
      (route as any)[method] = handler;
    }
  }

  return route;
}
`;
  }

  for (const [index, file] of apiFiles.entries()) {
    const routePath = apiFilePathToRoute(file, apiDir);

    // Import path for the API module relative to the generated routes file (.opaca/)
    const importRelPath =
      relative(outDir, file)
        .replace(/\\/g, "/")
        .replace(/\.(tsx|jsx|ts|js)$/, "");

    const nsImportVar = `Api_${index}_ns`;
    const apiVar = `Api_${index}`;
    const importPathForTs = toRelativeAssetPath(importRelPath);

    imports += `import * as ${nsImportVar} from "${importPathForTs}";\n`;
    apiRouteInit += `const ${apiVar} = __bunaToApiRoute(${nsImportVar});\n`;
    routesObject += `  "${routePath}": ${apiVar},\n`;
  }

  routesObject += "};\n";

  const tsContent = `// AUTO-GENERATED. DO NOT EDIT.
${imports}
${apiHelpers}
${apiRouteInit}
${routesObject}
`;

  await writeFile(join(outDir, "routes.generated.ts"), tsContent, "utf8");
}

async function fileExists(pathname: string): Promise<boolean> {
  try {
    const stats = await stat(pathname);
    return stats.isFile();
  } catch {
    return false;
  }
}

async function findLayoutFile(basePathWithoutExt: string): Promise<string | null> {
  for (const ext of LAYOUT_EXTENSIONS) {
    const candidate = `${basePathWithoutExt}${ext}`;
    if (await fileExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function getLayoutForDirectory(
  dir: string,
  cache: Map<string, string | null>,
): Promise<string | null> {
  if (cache.has(dir)) {
    return cache.get(dir) ?? null;
  }

  const layoutPath = await findLayoutFile(join(dir, "layout"));
  cache.set(dir, layoutPath ?? null);
  return layoutPath;
}

async function resolveLayoutChainForRoute(options: {
  filePath: string;
  routesDir: string;
  rootLayoutPath: string | null;
  cache: Map<string, string | null>;
}): Promise<string[]> {
  const chain: string[] = [];
  if (options.rootLayoutPath) {
    chain.push(options.rootLayoutPath);
  }

  const routeDir = dirname(options.filePath);
  const relativeDir = relative(options.routesDir, routeDir).replace(/\\/g, "/");
  const segments = relativeDir.split("/").filter(Boolean);
  const dirsToCheck: string[] = [];

  let currentDir = options.routesDir;
  dirsToCheck.push(currentDir);

  for (const segment of segments) {
    currentDir = join(currentDir, segment);
    dirsToCheck.push(currentDir);
  }

  for (const dir of dirsToCheck) {
    const layout = await getLayoutForDirectory(dir, options.cache);
    if (layout) {
      chain.push(layout);
    }
  }

  return chain;
}

async function writeRouteEntryModule(params: {
  entryDiskPath: string;
  layoutPaths: string[];
  routeImportPath: string;
  routePath: string;
}) {
  const entryDir = dirname(params.entryDiskPath);
  const layoutImports = params.layoutPaths.map((layoutPath, index) => {
    const importPath = relative(entryDir, layoutPath).replace(/\\/g, "/");
    const identifier = `Layout_${index}`;
    return { identifier, importPath };
  });

  let contents = "";

  if (layoutImports.length > 0) {
    contents += `import { registerPendingLayouts } from "opaca";\n`;
    for (const { identifier, importPath } of layoutImports) {
      contents += `import ${identifier} from "${importPath}";\n`;
    }
    const layoutList = layoutImports.map(item => item.identifier).join(", ");
    contents += `registerPendingLayouts([${layoutList}]);\n\n`;
  }

  contents += `import("${params.routeImportPath}")\n`;
  contents += `  .catch((error) => {\n`;
  contents += `    console.error("Failed to load route module for ${params.routePath}", error);\n`;
  contents += `  });\n`;

  await ensureDir(dirname(params.entryDiskPath));
  await writeFile(params.entryDiskPath, contents, "utf8");
}

function toRelativeAssetPath(pathname: string): string {
  if (pathname.startsWith("./") || pathname.startsWith("../")) {
    return pathname;
  }
  return `./${pathname}`;
}
