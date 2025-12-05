import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import {
  deriveComponentNameFromRoutePath,
  deriveServiceInfo,
  routePathToSegments,
} from "../shared/route-utils";

const PROJECT_ROOT = typeof process !== "undefined" ? process.cwd() : ".";
const ROUTES_ROOT = "src/routes";
const SERVICES_ROOT = "src/services";

type OpenRoutePayload = {
  path?: string;
  filePath?: string;
  line?: number;
  column?: number;
};

async function fileExists(filePath: string): Promise<boolean> {
  const resolved = resolve(PROJECT_ROOT, filePath);
  return existsSync(resolved);
}

function resolveRootPath(relativePath: string): string {
  return resolve(PROJECT_ROOT, relativePath);
}

function relativeRootPath(fullPath: string): string {
  return relative(PROJECT_ROOT, fullPath).replace(/\\/g, "/");
}

function ensureRelativeImport(from: string, to: string): string {
  let relativePath = relative(dirname(from), to).replace(/\\/g, "/");
  if (!relativePath.startsWith(".")) {
    relativePath = `./${relativePath}`;
  }
  return relativePath;
}

function buildRouteCandidates(routePath: string): string[] {
  const segments = routePathToSegments(routePath);
  const baseParts = [ROUTES_ROOT, ...segments];
  const base = baseParts.join("/");
  const candidates = [
    `${base}.tsx`,
    `${base}.ts`,
    `${base}/index.tsx`,
    `${base}/index.ts`,
  ];

  if (segments.length === 0) {
    candidates.unshift(`${ROUTES_ROOT}/index.tsx`, `${ROUTES_ROOT}/index.ts`);
  }

  return Array.from(new Set(candidates));
}

function findRouteFile(routePath: string): string | null {
  const candidates = buildRouteCandidates(routePath);
  for (const candidate of candidates) {
    const resolved = resolveRootPath(candidate);
    if (existsSync(resolved)) {
      return resolved;
    }
  }
  return null;
}

async function openFileInEditor(filePath: string, line?: number, column?: number) {
  const editor = process.env.OPACA_EDITOR || process.env.EDITOR || "code";
  const fileArg = line ? `${filePath}:${line}:${column ?? 1}` : filePath;
  const commandName = editor.split(/[\\/]/).pop() ?? editor;
  const useGoto = commandName.toLowerCase().startsWith("code");
  const args = useGoto ? ["--goto", fileArg] : [fileArg];

  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(editor, args, {
      stdio: "ignore",
      shell: false,
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`Editor exited with code ${code ?? "unknown"}.`));
      }
    });
    child.on("error", (err) => reject(err));
  });
}

function buildSimpleRouteTemplate(componentName: string, routePath?: string): string {
  const description = routePath ? `Route path: ${routePath}` : "New route component";
  return `import { createRoute, type RouteContext } from "opaca";

const ${componentName} = createRoute((ctx: RouteContext) => {
  return (
    <main className="min-h-screen grid place-items-center bg-slate-950 text-white">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Opaca route</p>
        <h1 className="text-2xl font-bold text-emerald-200">${description}</h1>
      </div>
    </main>
  );
});

export default ${componentName};
`;
}

function buildCrudRouteTemplate(options: {
  componentName: string;
  relativeServiceImport: string;
  typeName: string;
  routePath: string;
}): string {
  return `import { createRoute, type RouteContext } from "opaca";
import { useEffect, useState } from "react";
import { fetch${options.typeName}s } from "${options.relativeServiceImport}";

const ${options.componentName} = createRoute((ctx: RouteContext) => {
  const [items, setItems] = useState<${options.typeName}[]>([]);

  useEffect(() => {
    fetch${options.typeName}s().then((data) => {
      setItems(data);
    });
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-3xl font-bold text-emerald-300">
          Manage ${options.routePath}
        </h1>
        <p className="text-sm text-slate-500">
          This scaffold depends on <code>${options.relativeServiceImport}</code>.
        </p>
        <div className="border border-slate-800 bg-slate-900/80 rounded-lg p-4 space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Sample items</p>
          {items.length === 0 ? (
            <p className="text-slate-500">No items yet. Implement <code>fetch${options.typeName}s</code> to load real data.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs font-semibold text-slate-200"
                >
                  {JSON.stringify(item)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
});

export default ${options.componentName};
`;
}

function buildServiceTemplate(info: {
  typeName: string;
  identifier: string;
  baseRoute: string;
}): string {
  return `export type ${info.typeName} = {
  id: number;
  createdAt: string;
  title: string;
};

export async function fetch${info.typeName}s(): Promise<${info.typeName}[]> {
  return [];
}

export async function create${info.typeName}(payload: Partial<${info.typeName}>): Promise<${info.typeName}> {
  return {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    title: payload.title ?? "New item",
    ...payload,
  };
}

export const ${info.identifier} = {
  fetch: fetch${info.typeName}s,
  create: create${info.typeName},
};
`;
}

async function writeFileAtomic(filePath: string, content: string) {
  const absolute = resolveRootPath(filePath);
  if (existsSync(absolute)) {
    throw new Error(`File already exists: ${filePath}`);
  }
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, content, "utf8");
}

export async function scaffoldRoute(filePath: string, componentName: string, routePath?: string) {
  await writeFileAtomic(filePath, buildSimpleRouteTemplate(componentName, routePath));
  return resolveRootPath(filePath);
}

export async function scaffoldCrud(routePath: string) {
  const segments = routePathToSegments(routePath);
  const routeFile =
    segments.length > 0
      ? `${ROUTES_ROOT}/${segments.join("/")}.tsx`
      : `${ROUTES_ROOT}/index.tsx`;
  const componentName = deriveComponentNameFromRoutePath(routePath);
  const serviceInfo = deriveServiceInfo(routePath);
  const relativeServiceImport = ensureRelativeImport(routeFile, serviceInfo.fileName);

  await writeFileAtomic(serviceInfo.fileName, buildServiceTemplate({
    typeName: serviceInfo.typeName,
    identifier: serviceInfo.identifier,
    baseRoute: routePath,
  }));
  await writeFileAtomic(routeFile, buildCrudRouteTemplate({
    componentName,
    relativeServiceImport,
    typeName: serviceInfo.typeName,
    routePath,
  }));

  return {
    moduleFile: relativeRootPath(resolveRootPath(routeFile)),
    serviceFile: relativeRootPath(resolveRootPath(serviceInfo.fileName)),
  };
}

export async function openRouteInEditor(payload: OpenRoutePayload) {
  const fromFile = payload.filePath ? resolveRootPath(payload.filePath) : undefined;
  const fromRoute = payload.path ? findRouteFile(payload.path) : undefined;
  const resolvedFile = fromFile ?? fromRoute;

  if (!resolvedFile) {
    throw new Error("Could not locate the route file.");
  }

  await openFileInEditor(resolvedFile, payload.line, payload.column);
  return { file: relativeRootPath(resolvedFile) };
}
