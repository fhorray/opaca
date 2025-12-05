import { relative } from "node:path";

export type BunaHandleRequest = (
  request: Request,
  env: any,
  ctx: { waitUntil(promise: Promise<unknown>): void },
  config: any
) => Promise<Response>;

const PROJECT_ROOT = typeof process !== "undefined" ? process.cwd() : ".";
let serverDevtoolsModule: typeof import("./server/devtools") | null = null;

/**
 * Wrap a Opaca/Bun `handleRequest` function to expose internal
 * devtools endpoints under the `/__buna/*` namespace.
 *
 * Usage:
 *
 *   import { handleRequest } from "opaca/runtime";
 *   import { withDevtools } from "opaca-devtools";
 *
 *   const devHandleRequest = withDevtools(handleRequest);
 *
 *   // in Bun's `serve({ fetch })`:
 *   fetch(req) {
 *     return devHandleRequest(req, env, ctx, config);
 *   }
 */
export function withDevtools(base: BunaHandleRequest): BunaHandleRequest {
  return async function devtoolsHandleRequest(request, env, ctx, config) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method.toUpperCase();

    if (pathname.startsWith("/__opaca/devtools")) {
      try {
        if (pathname === "/__opaca/devtools/ping" && method === "GET") {
          return jsonResponse({ ok: true });
        }

        if (pathname === "/__opaca/devtools/open-route" && method === "POST") {
          const payload = await safeParse(request);
          const helpers = await ensureServerDevtools();
          const result = await helpers.openRouteInEditor(payload);
          return jsonResponse({ ok: true, ...result });
        }

        if (pathname === "/__opaca/devtools/scaffold-route" && method === "POST") {
          const payload = await request.json();
          const routePath = payload.routePath ?? payload.path;
          if (!payload.path || !payload.name) {
            return jsonResponse({ ok: false, error: "path and name are required" }, 400);
          }

          const helpers = await ensureServerDevtools();
          const created = await helpers.scaffoldRoute(payload.path, payload.name, routePath);
          return jsonResponse({ ok: true, path: relativeToRoot(created) });
        }

        if (pathname === "/__opaca/devtools/scaffold-crud" && method === "POST") {
          const payload = await request.json();
          if (!payload.routePath) {
            return jsonResponse({ ok: false, error: "routePath is required" }, 400);
          }

          const helpers = await ensureServerDevtools();
          const result = await helpers.scaffoldCrud(payload.routePath);
          return jsonResponse({ ok: true, ...result });
        }

        return new Response("Not Found", { status: 404 });
      } catch (error) {
        return jsonResponse(
          { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
          500,
        );
      }
    }

    // Backwards compatibility with the original namespace
    if (pathname === "/__buna/ping" && method === "GET") {
      return new Response("ok", { status: 200 });
    }

    if (pathname === "/__buna/create-route" && method === "POST") {
      return jsonResponse({
        ok: true,
        message: "create-route endpoint is wired but not implemented yet",
      });
    }

    return base(request, env, ctx, config);
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function safeParse(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function relativeToRoot(fullPath: string): string {
  return relative(PROJECT_ROOT, fullPath).replace(/\\/g, "/");
}

async function ensureServerDevtools() {
  if (serverDevtoolsModule) {
    return serverDevtoolsModule;
  }

  if (typeof process === "undefined") {
    throw new Error("Devtools server helpers are unavailable in this environment.");
  }

  serverDevtoolsModule = await import("./server/devtools");
  return serverDevtoolsModule;
}
