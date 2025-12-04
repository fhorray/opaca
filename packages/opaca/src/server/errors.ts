import { json } from "./response";

export interface ErrorBody {
  error: string;
  code?: string;
  details?: unknown;
  [key: string]: unknown;
}

/**
 * Create a JSON error response with a standard shape.
 */
export function error(
  message: string,
  status = 400,
  extra: Omit<ErrorBody, "error"> = {}
): Response {
  const body: ErrorBody = {
    error: message,
    ...extra,
  };

  return json(body, { status });
}

/**
 * 404 Not Found helper.
 */
export function notFound(message = "Not found"): Response {
  return error(message, 404);
}

/**
 * 401 Unauthorized helper.
 */
export function unauthorized(message = "Unauthorized"): Response {
  return error(message, 401);
}

/**
 * 403 Forbidden helper.
 */
export function forbidden(message = "Forbidden"): Response {
  return error(message, 403);
}

/**
 * 400 Bad Request helper.
 */
export function badRequest(message = "Bad request"): Response {
  return error(message, 400);
}

/**
 * 500 Internal Server Error helper.
 */
export function internalError(message = "Internal error"): Response {
  return error(message, 500);
}

/**
 * Helper for "ok" JSON responses with a standard envelope.
 */
export function ok<T>(data: T, status = 200): Response {
  return json(
    {
      ok: true,
      data,
    },
    { status }
  );
}

/**
 * Helper for "failed" JSON responses with a standard envelope.
 */
export function fail(message: string, status = 400, extra?: Record<string, unknown>): Response {
  return json(
    {
      ok: false,
      error: message,
      ...(extra || {}),
    },
    { status }
  );
}

/**
 * Assertion helper that throws a Response when the condition is falsy.
 */
export function assert(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) {
    throw error(message, status);
  }
}
