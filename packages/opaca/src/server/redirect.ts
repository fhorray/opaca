/**
 * Create a redirect Response with Location header.
 */
export function redirect(url: string, status: number = 302): Response {
  return new Response(null, {
    status,
    headers: {
      Location: url,
    },
  });
}

/**
 * 301 Moved Permanently redirect helper.
 */
export function permanentRedirect(url: string): Response {
  return redirect(url, 301);
}
