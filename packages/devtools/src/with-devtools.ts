export type BunaHandleRequest = (
  request: Request,
  env: any,
  ctx: { waitUntil(promise: Promise<unknown>): void },
  config: any
) => Promise<Response>;

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

    // Only intercept the devtools namespace
    if (!pathname.startsWith("/__buna")) {
      return base(request, env, ctx, config);
    }

    const method = request.method.toUpperCase();

    // Simple health check for the devtools channel
    if (pathname === "/__buna/ping" && method === "GET") {
      return new Response("ok", { status: 200 });
    }

    // Placeholder endpoint for future route creation tooling.
    // Frontend devtools can call this to orchestrate codegen or
    // other server-side actions.
    if (pathname === "/__buna/create-route" && method === "POST") {
      return new Response(
        JSON.stringify({
          ok: true,
          message: "create-route endpoint is wired but not implemented yet",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        },
      );
    }

    // Unknown devtools endpoint
    return new Response("Not Found", { status: 404 });
  };
}

