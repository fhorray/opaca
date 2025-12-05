import type { BunaRoute, ResolvedBunaConfig } from "../../core/config/types";
import type { BunaEnv, BunaExecutionContext } from "../types";

export async function handleRequest(
  request: Request,
  env: BunaEnv,
  ctx: BunaExecutionContext,
  config: ResolvedBunaConfig
): Promise<Response> {
  const url = new URL(request.url);

  // Simple example: delegate it to the router maybe?
  // heart of opaca
  const match = await matchRoute({
    routes: config.routes ?? {},
    pathname: url.pathname,
    method: request.method,
  });

  if (!match) {
    return new Response("Not Found", { status: 404 });
  }

  return match.handler({
    request,
    env,
    ctx,
    params: match.params,
  });
}

type RouteMatch = {
  params: Record<string, string>;
  handler: (ctx: {
    request: Request;
    env: BunaEnv;
    ctx: BunaExecutionContext;
    params: Record<string, string>;
  }) => Promise<Response>;
};

async function matchRoute(opts: {
  routes: BunaRoute;
  pathname: string;
  method: string;
}): Promise<RouteMatch | null> {
  // here we can use the opaca router to find the route + method
  // for now its just a stub and return null
  return null;
}
