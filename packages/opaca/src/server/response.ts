export interface JsonResponseInit extends ResponseInit {
  headers?: HeadersInit;
}

/**
 * Create a JSON response with proper Content-Type.
 */
export function json<T>(
  data: T,
  init: number | JsonResponseInit = {}
): Response {
  let options: JsonResponseInit;

  if (typeof init === "number") {
    options = { status: init };
  } else {
    options = init;
  }

  return new Response(JSON.stringify(data), {
    ...options,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(options.headers ?? {}),
    },
  });
}

/**
 * Create a plain text response.
 */
export function text(body: string, init: ResponseInit = {}): Response {
  const { headers, ...rest } = init;

  return new Response(body, {
    ...rest,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...(headers || {}),
    },
  });
}

/**
 * Create an HTML response.
 */
export function html(body: string, init: ResponseInit = {}): Response {
  const { headers, ...rest } = init;

  return new Response(body, {
    ...rest,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...(headers || {}),
    },
  });
}

/**
 * Create a binary/stream response.
 */
export function stream(
  body: ReadableStream | null,
  init: ResponseInit = {}
): Response {
  const { headers, ...rest } = init;

  return new Response(body, {
    ...rest,
    headers: {
      "Content-Type": "application/octet-stream",
      ...(headers || {}),
    },
  });
}
