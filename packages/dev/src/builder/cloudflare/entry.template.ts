// Template used to generate `cloudflare-entry.ts` inside the Cloudflare build output.
// The actual entry file is created next to `manifest.json` when the Cloudflare runtime is built.
import type {
  ExportedHandler,
  ExecutionContext,
  IncomingRequestCfProperties,
  Request as CfRequest,
  Response as CfResponse,
} from "@cloudflare/workers-types";

// @ts-expect-error since it will be generated at .opaca/cloudflare folder when users run "bun run build --runtime cloudflare"
type WorkerRequest = Request<unknown, IncomingRequestCfProperties<unknown>>;

declare global {
  interface BunaCloudflareWorkerEnv {
    // Extend this interface (e.g. `declare global { interface BunaCloudflareWorkerEnv { MY_BINDING: BindingType } }`)
    // inside your application to achieve precise binding types.
    [key: string]: any;
  }
}

type WorkerEnv = BunaCloudflareWorkerEnv;

type WorkerDataRoute = {
  pattern: string;
  html: string;
  regex: string | null;
};

type WorkerData = {
  routes: WorkerDataRoute[];
  htmlCacheControl: string;
  assetCacheControl: string;
  assetsBasePath: string;
};

type HtmlRoute = {
  pattern: string;
  html: string;
  matcher: RegExp | null;
};


// @ts-ignore since it will be generated at .opaca/cloudflare folder when users run "bun run build --runtime cloudflare"
import workerDataJson from "./manifest.json";

const workerData: WorkerData = workerDataJson;

const HTML_ROUTES: HtmlRoute[] = workerData.routes.map((route) => ({
  pattern: route.pattern,
  html: route.html,
  matcher: route.regex ? new RegExp(route.regex) : null,
}));

const HTML_HEADERS: HeadersInit = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": workerData.htmlCacheControl,
};

const ASSET_CACHE_HEADER = workerData.assetCacheControl;
const ASSET_PREFIX = workerData.assetsBasePath;
const ASSET_BINDING_KEY = "ASSETS" as const;

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function matchHtmlRoute(pathname: string): HtmlRoute | null {
  for (const route of HTML_ROUTES) {
    if (route.pattern === pathname) {
      return route;
    }
    if (route.matcher && route.matcher.test(pathname)) {
      return route;
    }
  }
  return null;
}

async function maybeServeBoundAsset(
  request: WorkerRequest,
  env: WorkerEnv,
): Promise<Response | null> {
  const assetBinding = env?.[ASSET_BINDING_KEY];
  if (!assetBinding) {
    return null;
  }

  const url = new URL(request.url);
  if (!url.pathname.startsWith(ASSET_PREFIX)) {
    return null;
  }

  const relativePath = url.pathname.slice(ASSET_PREFIX.length) || "/";
  const assetPath = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;

  const assetUrl = new URL(request.url);
  assetUrl.pathname = assetPath;
  assetUrl.search = "";
  assetUrl.hash = "";

  const assetRequest = new Request(assetUrl.toString(), request);
  const response = await assetBinding.fetch(assetRequest as any);
  if (!response || response.status === 404) {
    return null;
  }

  const headers = new Headers(response.headers);
  if (ASSET_CACHE_HEADER) {
    headers.set("cache-control", ASSET_CACHE_HEADER);
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

const worker = {
  async fetch(
    request: WorkerRequest,
    env: WorkerEnv,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const normalized = normalizePath(url.pathname);

    const assetResponse = await maybeServeBoundAsset(request, env);
    if (assetResponse) {
      return assetResponse;
    }

    const route = matchHtmlRoute(normalized);
    if (route) {
      return new Response(route.html, { headers: HTML_HEADERS });
    }

    return new Response("Not Found", { status: 404 });
  },
};

// @ts-expect-error since it will be generated at .opaca/cloudflare folder when users run "bun run build --runtime cloudflare"
export default worker satisfies ExportedHandler<WorkerEnv>;
