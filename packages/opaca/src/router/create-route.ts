import { createRoot } from "react-dom/client";
import { createElement } from "react";
import type { ReactNode } from "react";
import type { BunaMeta, BunaMetaRobots } from "./types";
import { consumePendingLayouts, type BunaLayoutComponent } from "./layout-registry";

export interface RouteContext<
  Params extends Record<string, string> = Record<string, string>,
> {
  params?: Params;
  searchParams?: URLSearchParams;
  hash?: string;
}

export type BunaMetaResolver<C = RouteContext> =
  | BunaMeta
  | ((ctx: C) => BunaMeta);

// Component type: function + optional static `meta`
export type RouteComponent<C = RouteContext> = ((
  ctx: C,
) => ReactNode) & {
  meta?: BunaMetaResolver<C>;
};

/**
 * Parse dynamic route parameters based on a pattern like:
 *   "/blog/:id" or "/docs/*"
 */
function parseParamsFromPattern(pathname: string, pattern: string): Record<string, string> {
  const params: Record<string, string> = {};

  const pathSegments = pathname.split("/").filter(Boolean);
  const patternSegments = pattern.split("/").filter(Boolean);

  for (let i = 0; i < patternSegments.length; i++) {
    const pat = patternSegments[i];
    const value = pathSegments[i];

    if (!pat) continue;

    if (pat === "*") {
      params["*"] = pathSegments.slice(i).join("/");
      break;
    }

    if (pat.startsWith(":")) {
      const key = pat.slice(1);
      if (key) {
        params[key] = value ?? "";
      }
    }
  }

  return params;
}

/**
 * Build RouteContext from the current browser URL.
 * Uses the route pattern injected into the HTML by the generator
 * (via <body data-opaca-route="...">) to populate params.
 */
function getClientRouteContext(): RouteContext {
  if (typeof window === "undefined") return {};

  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  const hash = url.hash || undefined;

  let pattern: string | undefined;
  if (typeof document !== "undefined") {
    pattern = document.body.getAttribute("data-opaca-route") || undefined;
  }

  const params =
    pattern && pattern !== url.pathname
      ? parseParamsFromPattern(url.pathname, pattern)
      : {};

  return { params, searchParams, hash };
}

/**
 * Resolve BunaMeta from object or function.
 */
function resolveMeta<C>(
  resolver: BunaMetaResolver<C> | undefined,
  ctx: C,
): BunaMeta | undefined {
  if (!resolver) return undefined;
  return typeof resolver === "function"
    ? (resolver as (c: C) => BunaMeta)(ctx)
    : resolver;
}

/**
 * Convert robots object to string directive.
 */
function robotsObjectToString(robots: BunaMetaRobots): string {
  const tokens: string[] = [];

  if (robots.index === false) tokens.push("noindex");
  if (robots.index !== false) tokens.push("index");

  if (robots.follow === false) tokens.push("nofollow");
  if (robots.follow !== false) tokens.push("follow");

  if (robots.noarchive) tokens.push("noarchive");
  if (robots.nosnippet) tokens.push("nosnippet");
  if (robots.noimageindex) tokens.push("noimageindex");
  if (robots.noodp) tokens.push("noodp");
  if (robots.notranslate) tokens.push("notranslate");

  return Array.from(new Set(tokens)).join(",");
}

/**
 * Ensure a <meta> tag with given name exists and set content.
 */
function setNamedMeta(name: string, content: string | undefined) {
  if (!content) return;

  let tag = document.head.querySelector<HTMLMetaElement>(
    `meta[name="${name}"][data-opaca-meta="true"]`,
  );
  if (!tag) {
    tag = document.createElement("meta");
    tag.name = name;
    tag.setAttribute("data-opaca-meta", "true");
    document.head.appendChild(tag);
  }
  tag.content = content;
}

/**
 * Ensure a <meta> tag with given property exists and set content.
 */
function setPropertyMeta(property: string, content: string | undefined) {
  if (!content) return;

  let tag = document.head.querySelector<HTMLMetaElement>(
    `meta[property="${property}"][data-opaca-meta="true"]`,
  );
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
    tag.setAttribute("data-opaca-meta", "true");
    document.head.appendChild(tag);
  }
  tag.content = content;
}

/**
 * Ensure a <link> tag with given rel+href exists and set attributes.
 */
function setLink(
  attrs: { rel: string; href: string } & Record<string, string | undefined>,
) {
  const { rel, href, ...rest } = attrs;
  if (!href) return;

  let tag = document.head.querySelector<HTMLLinkElement>(
    `link[rel="${rel}"][href="${href}"][data-opaca-meta="true"]`,
  );
  if (!tag) {
    tag = document.createElement("link");
    tag.rel = rel;
    tag.href = href;
    tag.setAttribute("data-opaca-meta", "true");
    document.head.appendChild(tag);
  }

  Object.entries(rest).forEach(([key, value]) => {
    if (!value) return;
    tag.setAttribute(key, value);
  });
}

/**
 * Remove all previous Opaca-managed tags before applying new ones.
 */
function clearPreviousBunaTags() {
  const tags = document.head.querySelectorAll<
    HTMLMetaElement | HTMLLinkElement | HTMLScriptElement
  >('[data-opaca-meta="true"]');
  tags.forEach((node) => node.remove());
}

/**
 * Apply BunaMeta to document <head>.
 */
function applyBunaMeta(meta?: BunaMeta) {
  if (!meta) return;
  if (typeof document === "undefined") return;

  // Clear previous Opaca-managed tags to avoid duplicates
  clearPreviousBunaTags();

  // <title>
  document.title = meta.title;

  // <html lang="">
  if (meta.htmlLang) {
    document.documentElement.lang = meta.htmlLang;
  }

  // <meta charset="...">
  if (meta.charset) {
    let charsetTag = document.head.querySelector<HTMLMetaElement>(
      'meta[charset][data-opaca-meta="true"]',
    );
    if (!charsetTag) {
      charsetTag = document.createElement("meta");
      charsetTag.setAttribute("data-opaca-meta", "true");
      document.head.insertBefore(charsetTag, document.head.firstChild);
    }
    charsetTag.setAttribute("charset", meta.charset);
  }

  // Basic meta tags
  if (meta.description) {
    setNamedMeta("description", meta.description);
  }

  if (meta.keywords && meta.keywords.length > 0) {
    setNamedMeta("keywords", meta.keywords.join(", "));
  }

  if (meta.viewport) {
    setNamedMeta("viewport", meta.viewport);
  }

  if (meta.author) {
    setNamedMeta("author", meta.author);
  }

  if (meta.themeColor) {
    setNamedMeta("theme-color", meta.themeColor);
  }

  if (meta.colorScheme) {
    setNamedMeta("color-scheme", meta.colorScheme);
  }

  // Robots
  if (meta.robots) {
    const robotsContent =
      typeof meta.robots === "string"
        ? meta.robots
        : robotsObjectToString(meta.robots);
    setNamedMeta("robots", robotsContent);
  }

  // Canonical
  if (meta.canonicalUrl) {
    setLink({ rel: "canonical", href: meta.canonicalUrl });
  }

  // Favicon
  if (meta.faviconUrl) {
    setLink({ rel: "icon", href: meta.faviconUrl });
  }

  // Alternates
  if (meta.alternates) {
    meta.alternates.forEach((alt) => {
      setLink({ rel: "alternate", href: alt.href, hrefLang: alt.hrefLang });
    });
  }

  // Open Graph
  if (meta.openGraph) {
    const og = meta.openGraph;
    if (og.title) setPropertyMeta("og:title", og.title);
    if (og.description) setPropertyMeta("og:description", og.description);
    if (og.url) setPropertyMeta("og:url", og.url);
    if (og.siteName) setPropertyMeta("og:site_name", og.siteName);
    if (og.type) setPropertyMeta("og:type", og.type);
    if (og.locale) setPropertyMeta("og:locale", og.locale);

    if (og.images && og.images.length > 0) {
      og.images.forEach((image, index) => {
        const suffix = og.images && og.images.length > 1 ? `:${index}` : "";
        setPropertyMeta(`og:image${suffix}`, image.url);
        if (image.width) {
          setPropertyMeta(`og:image:width${suffix}`, String(image.width));
        }
        if (image.height) {
          setPropertyMeta(`og:image:height${suffix}`, String(image.height));
        }
        if (image.alt) {
          setPropertyMeta(`og:image:alt${suffix}`, image.alt);
        }
        if (image.type) {
          setPropertyMeta(`og:image:type${suffix}`, image.type);
        }
      });
    }
  }

  // Twitter
  if (meta.twitter) {
    const tw = meta.twitter;
    if (tw.card) setNamedMeta("twitter:card", tw.card);
    if (tw.site) setNamedMeta("twitter:site", tw.site);
    if (tw.creator) setNamedMeta("twitter:creator", tw.creator);
    if (tw.title) setNamedMeta("twitter:title", tw.title);
    if (tw.description) setNamedMeta("twitter:description", tw.description);
    if (tw.image) setNamedMeta("twitter:image", tw.image);
    if (tw.imageAlt) setNamedMeta("twitter:image:alt", tw.imageAlt);
  }

  // Extra meta
  if (meta.extraMeta) {
    meta.extraMeta.forEach((item) => {
      const tag = document.createElement("meta");
      tag.setAttribute("data-opaca-meta", "true");
      if (item.name) tag.name = item.name;
      if (item.property) tag.setAttribute("property", item.property);
      if (item.httpEquiv) tag.httpEquiv = item.httpEquiv;
      tag.content = item.content;
      document.head.appendChild(tag);
    });
  }

  // Extra links
  if (meta.extraLinks) {
    meta.extraLinks.forEach((link) => {
      setLink(link as any);
    });
  }

  // Structured data (JSON-LD)
  if (meta.structuredData) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-opaca-meta", "true");
    script.text = JSON.stringify(meta.structuredData);
    document.head.appendChild(script);
  }
}

/**
 * createRoute
 * -----------
 * Wraps a user component to provide automatic client-side bootstrapping.
 *
 * - Returns the component as a RouteComponent (function + meta?).
 * - When running in the browser:
 *   - builds a RouteContext from the current URL
 *   - resolves BunaMeta from Component.meta (object or function)
 *   - applies BunaMeta to <head>
 *   - auto-mounts it into #root.
 */
export function createRoute<C extends RouteContext = RouteContext>(
  Component: (ctx: C) => ReactNode,
): RouteComponent<C> {
  const ComponentWithMeta = Component as RouteComponent<C>;

  if (typeof document !== "undefined") {
    // Defer to ensure `ComponentWithMeta.meta` can be assigned after createRoute call
    queueMicrotask(() => {
      const container = document.getElementById("root");
      if (!container) return;

      const ctx = getClientRouteContext() as C;

      const meta = resolveMeta(ComponentWithMeta.meta, ctx);
      if (meta) {
        applyBunaMeta(meta);
      }

      const layouts = consumePendingLayouts<C>();
      const root = createRoot(container);

      root.render(
        wrapWithLayouts(
          createElement(ComponentWithMeta, ctx as C),
          layouts,
          ctx,
        ),
      );
    });
  }

  return ComponentWithMeta;
}

function wrapWithLayouts<C extends RouteContext>(
  element: ReactNode,
  layouts: BunaLayoutComponent<C>[] | undefined,
  ctx: C,
): ReactNode {
  if (!layouts || layouts.length === 0) {
    return element;
  }

  return layouts.reduceRight<ReactNode>((child, LayoutComponent) => {
    return createElement(LayoutComponent, { ctx, children: child });
  }, element);
}
