export interface CookieOptions {
  maxAge?: number;
  path?: string;
  domain?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

/**
 * Build a Set-Cookie header value.
 */
export function createCookieHeader(
  name: string,
  value: string,
  options: CookieOptions = {}
): string {
  const parts: string[] = [];

  parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  parts.push(`Path=${options.path ?? "/"}`);

  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options.secure) {
    parts.push("Secure");
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  return parts.join("; ");
}

/**
 * Append a Set-Cookie header to a Response.
 *
 * This returns a new Response instance with cloned body and headers.
 */
export function setCookie(
  res: Response,
  name: string,
  value: string,
  options: CookieOptions = {}
): Response {
  const headers = new Headers(res.headers);
  headers.append("Set-Cookie", createCookieHeader(name, value, options));

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

/**
 * Clear a cookie by setting it with Max-Age=0.
 */
export function clearCookie(res: Response, name: string, options: CookieOptions = {}): Response {
  return setCookie(res, name, "", { ...options, maxAge: 0 });
}

/**
 * Parse cookies from a Request.
 */
export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.get("Cookie");
  const cookies: Record<string, string> = {};

  if (!header) return cookies;

  const pairs = header.split(/; */);

  for (const pair of pairs) {
    const [rawName, ...rest] = pair.split("=");
    if (!rawName) continue;

    const name = decodeURIComponent(rawName.trim());
    const value = decodeURIComponent(rest.join("=").trim());

    cookies[name] = value;
  }

  return cookies;
}
