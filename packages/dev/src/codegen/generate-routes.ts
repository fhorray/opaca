import { mkdir, readdir, stat, writeFile, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { CSS_ENTRY_PATH, FAVICON_ENTRY_PATH, ROOT_LAYOUT_ENTRY_PATH } from "./constants";
import { ResolvedBunaConfig } from "opaca";

const LAYOUT_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];
const API_DIR = "src/api";

type SeoMeta = Record<string, unknown>;

type SeoHealth = {
  score: number;
  issues: string[];
  checks: Record<string, boolean>;
};

type RouteManifestEntry = {
  path: string;
  routeFile: string;
  htmlPath: string;
  entryPath: string;
  seo: SeoMeta | null;
  seoHealth: SeoHealth;
};

type ManifestSummary = {
  totalRoutes: number;
  averageScore: number;
  missingMetaRoutes: number;
  healthyRoutes: number;
  healthWarnings: string[];
};

type MetaExtraction =
  | { type: "object"; text: string }
  | { type: "function" }
  | { type: "none" };

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
  const manifestEntries: RouteManifestEntry[] = [];

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

    const seoMeta = await parseRouteMeta(file);
    manifestEntries.push({
      path: routePath,
      routeFile: toPosixPath(relative(projectRoot, file)),
      htmlPath: toPosixPath(relative(projectRoot, htmlDiskPath)),
      entryPath: toPosixPath(relative(projectRoot, entryDiskPath)),
      seo: seoMeta,
      seoHealth: computeSeoHealth(seoMeta),
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

  const manifestDir = join(projectRoot, ".opaca");
  await ensureDir(manifestDir);
  const manifest = {
    generatedAt: new Date().toISOString(),
    summary: createManifestSummary(manifestEntries),
    routes: manifestEntries,
  };
  await writeFile(join(manifestDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
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

async function parseRouteMeta(filePath: string): Promise<SeoMeta | null> {
  try {
    const source = await readFile(filePath, "utf8");
    const extraction = extractMetaBlock(source);
    if (extraction.type !== "object" || !extraction.text) {
      return null;
    }

    const parser = new MetaParser(extraction.text);
    const value = parser.parseValue();
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as SeoMeta;
    }
  } catch {
    // ignore parse errors
  }

  return null;
}

function createManifestSummary(entries: RouteManifestEntry[]): ManifestSummary {
  const totalRoutes = entries.length;
  const averageScore =
    totalRoutes === 0
      ? 0
      : Number(
        (
          entries.reduce((acc, entry) => acc + entry.seoHealth.score, 0) / totalRoutes
        ).toFixed(2),
      );
  const missingMetaRoutes = entries.filter(entry => !entry.seo).length;
  const healthyRoutes = entries.filter(entry => entry.seoHealth.score >= 70).length;
  const healthWarnings = Array.from(
    new Set(entries.flatMap(entry => entry.seoHealth.issues)),
  );

  return {
    totalRoutes,
    averageScore,
    missingMetaRoutes,
    healthyRoutes,
    healthWarnings,
  };
}

function toPosixPath(pathname: string): string {
  return pathname.replace(/\\/g, "/");
}

function computeSeoHealth(meta: SeoMeta | null): SeoHealth {
  const issues: string[] = [];
  const checks: Record<string, boolean> = {
    hasMeta: Boolean(meta),
    hasTitle: false,
    hasDescription: false,
    hasKeywords: false,
    hasCanonical: false,
    hasRobots: false,
    hasOpenGraph: false,
    hasTwitter: false,
  };

  if (!meta) {
    issues.push("Route does not expose metadata.");
    return { score: 10, issues, checks };
  }

  const titleValue = meta.title;
  if (typeof titleValue === "string" && titleValue.trim().length > 0) {
    checks.hasTitle = true;
  } else {
    issues.push("Missing <title>.");
  }

  const descriptionValue = meta.description;
  if (typeof descriptionValue === "string" && descriptionValue.trim().length > 0) {
    checks.hasDescription = true;
  } else {
    issues.push("Missing meta description.");
  }

  const keywordsValue = meta.keywords;
  if (Array.isArray(keywordsValue) && keywordsValue.length > 0) {
    checks.hasKeywords = true;
  } else {
    issues.push("No keywords defined.");
  }

  const canonicalValue = meta.canonicalUrl;
  if (typeof canonicalValue === "string" && canonicalValue.trim().length > 0) {
    checks.hasCanonical = true;
  } else {
    issues.push("Missing canonical URL.");
  }

  if (meta.robots != null) {
    checks.hasRobots = true;
  } else {
    issues.push("Missing robots directives.");
  }

  if (meta.openGraph && typeof meta.openGraph === "object") {
    checks.hasOpenGraph = true;
  } else {
    issues.push("Missing Open Graph metadata.");
  }

  if (meta.twitter && typeof meta.twitter === "object") {
    checks.hasTwitter = true;
  } else {
    issues.push("Missing Twitter card metadata.");
  }

  let score = 100;
  if (!checks.hasTitle) score -= 25;
  if (!checks.hasDescription) score -= 20;
  if (!checks.hasKeywords) score -= 5;
  if (!checks.hasCanonical) score -= 10;
  if (!checks.hasRobots) score -= 5;
  if (!checks.hasOpenGraph) score -= 10;
  if (!checks.hasTwitter) score -= 10;

  score = Math.max(0, Math.min(100, score));

  return { score, issues, checks };
}

function extractMetaBlock(source: string): MetaExtraction {
  const metaPattern = /\.meta\s*=/g;
  let match: RegExpExecArray | null = null;

  while ((match = metaPattern.exec(source)) !== null) {
    let cursor = match.index + match[0].length;
    cursor = skipWhitespace(source, cursor);
    const char = source[cursor];

    if (char === "{") {
      const block = captureBalancedBraces(source, cursor);
      if (block) {
        return { type: "object", text: block };
      }
      return { type: "object", text: "" };
    }

    if (!char) {
      return { type: "none" };
    }

    if (char === "(" || /[A-Za-z_$]/.test(char)) {
      return { type: "function" };
    }
  }

  return { type: "none" };
}

function skipWhitespace(text: string, start: number): number {
  let idx = start;
  while (idx < text.length) {
    const char = text[idx];
    if (char === " " || char === "\t" || char === "\n" || char === "\r") {
      idx++;
      continue;
    }

    if (char === "/" && text[idx + 1] === "/") {
      idx += 2;
      while (idx < text.length && text[idx] !== "\n" && text[idx] !== "\r") {
        idx++;
      }
      continue;
    }

    if (char === "/" && text[idx + 1] === "*") {
      idx += 2;
      while (idx < text.length) {
        if (text[idx] === "*" && text[idx + 1] === "/") {
          idx += 2;
          break;
        }
        idx++;
      }
      continue;
    }

    break;
  }

  return idx;
}

function captureBalancedBraces(source: string, start: number): string | null {
  let depth = 0;
  let idx = start;
  const length = source.length;
  let inString: string | null = null;
  let escaping = false;

  while (idx < length) {
    const char = source[idx];

    if (escaping) {
      escaping = false;
      idx++;
      continue;
    }

    if (inString) {
      if (char === "\\") {
        escaping = true;
      } else if (char === inString) {
        inString = null;
      }
      idx++;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = char;
      idx++;
      continue;
    }

    if (char === "{") {
      depth++;
      idx++;
      continue;
    }

    if (char === "}") {
      depth--;
      idx++;
      if (depth === 0) {
        return source.slice(start, idx);
      }
      continue;
    }

    if (char === "/" && source[idx + 1] === "/") {
      idx += 2;
      while (idx < length && source[idx] !== "\n" && source[idx] !== "\r") {
        idx++;
      }
      continue;
    }

    if (char === "/" && source[idx + 1] === "*") {
      idx += 2;
      while (idx < length) {
        if (source[idx] === "*" && source[idx + 1] === "/") {
          idx += 2;
          break;
        }
        idx++;
      }
      continue;
    }

    idx++;
  }

  return null;
}

class MetaParser {
  private index = 0;

  constructor(private readonly text: string) { }

  parseValue(): unknown {
    this.skipWhitespace();
    if (this.index >= this.text.length) {
      throw new Error("Unexpected end of meta object");
    }

    const char = this.text[this.index];

    if (char === "{") {
      return this.parseObject();
    }

    if (char === "[") {
      return this.parseArray();
    }

    if (char === '"' || char === "'" || char === "`") {
      return this.parseString();
    }

    if (char === "-" || char === "+" || /[0-9]/.test(char)) {
      return this.parseNumber();
    }

    return this.parseIdentifier();
  }

  private parseObject(): Record<string, unknown> {
    if (this.text[this.index] !== "{") {
      throw new Error("Expected object literal");
    }

    this.index++;
    const result: Record<string, unknown> = {};

    while (true) {
      this.skipWhitespace();

      if (this.index >= this.text.length) {
        throw new Error("Unexpected end of object");
      }

      if (this.text[this.index] === "}") {
        this.index++;
        break;
      }

      const key = this.parsePropertyName();
      this.skipWhitespace();

      if (this.text[this.index] !== ":") {
        throw new Error("Missing colon in object literal");
      }

      this.index++;
      const value = this.parseValue();
      result[key] = value;

      this.skipWhitespace();
      const next = this.text[this.index];
      if (next === ",") {
        this.index++;
        continue;
      }

      if (next === "}") {
        continue;
      }

      throw new Error("Unexpected object delimiter");
    }

    return result;
  }

  private parseArray(): unknown[] {
    if (this.text[this.index] !== "[") {
      throw new Error("Expected array literal");
    }

    this.index++;
    const items: unknown[] = [];

    while (true) {
      this.skipWhitespace();

      if (this.index >= this.text.length) {
        throw new Error("Unexpected end of array");
      }

      if (this.text[this.index] === "]") {
        this.index++;
        break;
      }

      items.push(this.parseValue());

      this.skipWhitespace();
      const next = this.text[this.index];
      if (next === ",") {
        this.index++;
        continue;
      }

      if (next === "]") {
        continue;
      }

      throw new Error("Unexpected array delimiter");
    }

    return items;
  }

  private parseString(): string {
    const quote = this.text[this.index];
    this.index++;
    let value = "";

    while (this.index < this.text.length) {
      const char = this.text[this.index++];

      if (char === "\\") {
        if (this.index >= this.text.length) {
          break;
        }
        const next = this.text[this.index++];
        switch (next) {
          case "n":
            value += "\n";
            break;
          case "r":
            value += "\r";
            break;
          case "t":
            value += "\t";
            break;
          case "b":
            value += "\b";
            break;
          case "f":
            value += "\f";
            break;
          default:
            value += next;
        }
        continue;
      }

      if (char === quote) {
        return value;
      }

      value += char;
    }

    throw new Error("Unterminated string literal");
  }

  private parseNumber(): number {
    const start = this.index;

    if (this.text[this.index] === "-" || this.text[this.index] === "+") {
      this.index++;
    }

    while (this.index < this.text.length && /[0-9]/.test(this.text[this.index])) {
      this.index++;
    }

    if (this.text[this.index] === ".") {
      this.index++;
      while (this.index < this.text.length && /[0-9]/.test(this.text[this.index])) {
        this.index++;
      }
    }

    if (this.text[this.index] === "e" || this.text[this.index] === "E") {
      this.index++;
      if (this.text[this.index] === "+" || this.text[this.index] === "-") {
        this.index++;
      }
      while (this.index < this.text.length && /[0-9]/.test(this.text[this.index])) {
        this.index++;
      }
    }

    const raw = this.text.slice(start, this.index);
    const value = Number(raw);
    if (Number.isNaN(value)) {
      throw new Error(`Invalid number literal ${raw}`);
    }

    return value;
  }

  private parseIdentifier(): unknown {
    const start = this.index;

    while (this.index < this.text.length && /[A-Za-z0-9_$]/.test(this.text[this.index])) {
      this.index++;
    }

    const token = this.text.slice(start, this.index);
    if (token === "true") return true;
    if (token === "false") return false;
    if (token === "null") return null;

    throw new Error(`Unsupported identifier ${token}`);
  }

  private parsePropertyName(): string {
    this.skipWhitespace();

    if (this.index >= this.text.length) {
      throw new Error("Unexpected end while reading property name");
    }

    const char = this.text[this.index];
    if (char === '"' || char === "'" || char === "`") {
      return this.parseString();
    }

    const start = this.index;
    while (this.index < this.text.length && /[A-Za-z0-9_$]/.test(this.text[this.index])) {
      this.index++;
    }

    if (start === this.index) {
      throw new Error("Invalid property name");
    }

    return this.text.slice(start, this.index);
  }

  private skipWhitespace(): void {
    while (this.index < this.text.length) {
      const char = this.text[this.index];

      if (char === " " || char === "\t" || char === "\n" || char === "\r") {
        this.index++;
        continue;
      }

      if (char === "/" && this.text[this.index + 1] === "/") {
        this.index += 2;
        while (
          this.index < this.text.length &&
          this.text[this.index] !== "\n" &&
          this.text[this.index] !== "\r"
        ) {
          this.index++;
        }
        continue;
      }

      if (char === "/" && this.text[this.index + 1] === "*") {
        this.index += 2;
        while (this.index < this.text.length) {
          if (this.text[this.index] === "*" && this.text[this.index + 1] === "/") {
            this.index += 2;
            break;
          }
          this.index++;
        }
        continue;
      }

      break;
    }
  }
}

function toRelativeAssetPath(pathname: string): string {
  if (pathname.startsWith("./") || pathname.startsWith("../")) {
    return pathname;
  }
  return `./${pathname}`;
}
