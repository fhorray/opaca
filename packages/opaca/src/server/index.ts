import { html, json, stream, text } from "./response";
import {
  assert,
  badRequest,
  error,
  fail,
  forbidden,
  internalError,
  notFound,
  ok,
  unauthorized,
} from "./errors";
import { permanentRedirect, redirect } from "./redirect";
import {
  clearCookie,
  createCookieHeader,
  parseCookies,
  setCookie,
  type CookieOptions,
} from "./cookies";
import { paginate } from "./paginate";

// Re-export primitives for direct use if desired
export * from "./response";
export * from "./errors";
export * from "./redirect";
export * from "./cookies";
export * from "./paginate";

export type EndpointMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD";

export interface EndpointResponseHelpers {
  json: typeof json;
  text: typeof text;
  html: typeof html;
  stream: typeof stream;
  error: typeof error;
  notFound: typeof notFound;
  unauthorized: typeof unauthorized;
  forbidden: typeof forbidden;
  badRequest: typeof badRequest;
  internalError: typeof internalError;
  ok: typeof ok;
  fail: typeof fail;
  redirect: typeof redirect;
  permanentRedirect: typeof permanentRedirect;
  paginate: typeof paginate;
}

export interface EndpointCookiesHelpers {
  all(): Record<string, string>;
  get(name: string): string | undefined;
  set(name: string, value: string, options?: CookieOptions): void;
  clear(name: string, options?: CookieOptions): void;
}

export interface EndpointContext {
  req: Request;
  method: string;
  url: URL;
  params: Record<string, string>;
  query: URLSearchParams;
  /**
   * Grouped response helpers (for DX: ctx.res.json, ctx.res.error, ...).
   */
  res: EndpointResponseHelpers;
  /**
   * Cookie helpers bound to the current response lifecycle.
   * Any cookies scheduled via set/clear are applied after the handler returns.
   */
  cookies: EndpointCookiesHelpers;
  // Direct access to helpers if you prefer flat usage: ctx.json, ctx.error, etc.
  json: typeof json;
  text: typeof text;
  html: typeof html;
  stream: typeof stream;
  error: typeof error;
  notFound: typeof notFound;
  unauthorized: typeof unauthorized;
  forbidden: typeof forbidden;
  badRequest: typeof badRequest;
  internalError: typeof internalError;
  ok: typeof ok;
  fail: typeof fail;
  redirect: typeof redirect;
  permanentRedirect: typeof permanentRedirect;
  paginate: typeof paginate;
  assert: typeof assert;
}

export type EndpointHandler = (ctx: EndpointContext) => Response | Promise<Response>;
export type EndpointRequestHandler = (req: Request) => Promise<Response>;

/**
 * Internal helper that builds the context and wires cookies/response helpers.
 */
function createEndpointWithContext(handler: EndpointHandler): EndpointRequestHandler {
  return async function endpoint(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const params = ((req as any).params ?? {}) as Record<string, string>;
    const query = url.searchParams;
    const cookieMap = parseCookies(req);

    const pendingSet: Array<{ name: string; value: string; options?: CookieOptions }> = [];
    const pendingClear: Array<{ name: string; options?: CookieOptions }> = [];

    const resHelpers: EndpointResponseHelpers = {
      json,
      text,
      html,
      stream,
      error,
      notFound,
      unauthorized,
      forbidden,
      badRequest,
      internalError,
      ok,
      fail,
      redirect,
      permanentRedirect,
      paginate,
    };

    const cookiesHelpers: EndpointCookiesHelpers = {
      all: () => ({ ...cookieMap }),
      get: name => cookieMap[name],
      set: (name, value, options) => {
        pendingSet.push({ name, value, options });
      },
      clear: (name, options) => {
        pendingClear.push({ name, options });
      },
    };

    const ctx: EndpointContext = {
      req,
      method: req.method,
      url,
      params,
      query,
      res: resHelpers,
      cookies: cookiesHelpers,
      json,
      text,
      html,
      stream,
      error,
      notFound,
      unauthorized,
      forbidden,
      badRequest,
      internalError,
      ok,
      fail,
      redirect,
      permanentRedirect,
      paginate,
      assert,
    };

    let response = await handler(ctx);

    // Apply pending cookies to the final Response.
    for (const { name, value, options } of pendingSet) {
      response = setCookie(response, name, value, options);
    }
    for (const { name, options } of pendingClear) {
      response = clearCookie(response, name, options);
    }

    return response;
  };
}

/**
 * Low-level factory:
 *  - If called with a handler only: no method check.
 *  - If called with method + handler: enforces HTTP method.
 */
export function createEndpoint(
  method: EndpointMethod,
  handler: EndpointHandler
): EndpointRequestHandler;
export function createEndpoint(handler: EndpointHandler): EndpointRequestHandler;
export function createEndpoint(
  methodOrHandler: EndpointMethod | EndpointHandler,
  maybeHandler?: EndpointHandler
): EndpointRequestHandler {
  if (typeof methodOrHandler === "function") {
    // No method guard.
    return createEndpointWithContext(methodOrHandler);
  }

  const expectedMethod = methodOrHandler;
  const handler = maybeHandler as EndpointHandler;

  const guardedHandler: EndpointHandler = async ctx => {
    if (ctx.method.toUpperCase() !== expectedMethod) {
      return error("Method Not Allowed", 405, { allowed: [expectedMethod] });
    }
    return handler(ctx);
  };

  return createEndpointWithContext(guardedHandler);
}

/**
 * Convenience helpers for each HTTP method.
 * Usage:
 *
 *   export const GET = server.GET(async ({ res }) => {
 *     return res.json({ hello: "world" });
 *   });
 */
export function createGET(handler: EndpointHandler): EndpointRequestHandler {
  return createEndpoint("GET", handler);
}

export function createPOST(handler: EndpointHandler): EndpointRequestHandler {
  return createEndpoint("POST", handler);
}

export function createPUT(handler: EndpointHandler): EndpointRequestHandler {
  return createEndpoint("PUT", handler);
}

export function createPATCH(handler: EndpointHandler): EndpointRequestHandler {
  return createEndpoint("PATCH", handler);
}

export function createDELETE(handler: EndpointHandler): EndpointRequestHandler {
  return createEndpoint("DELETE", handler);
}

export function createOPTIONS(handler: EndpointHandler): EndpointRequestHandler {
  return createEndpoint("OPTIONS", handler);
}

export function createHEAD(handler: EndpointHandler): EndpointRequestHandler {
  return createEndpoint("HEAD", handler);
}

