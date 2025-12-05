import { RouteNode } from "../panel/router";

const ROUTES_ROOT = "src/routes";
const SERVICES_ROOT = "src/services";

export type RouteNameMetadata = {
  fileName: string;
  componentName: string;
};

function cleanInput(input: string): string {
  return input.replace(/[^a-zA-Z0-9-_]/g, "");
}

function toPascalCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join("");
}

function ensurePageSuffix(value: string): string {
  if (!value) {
    return "NewRoutePage";
  }
  return value.endsWith("Page") ? value : `${value}Page`;
}

function deriveFileNameFromPascal(pascal: string): string {
  if (!pascal) {
    return "new-route.tsx";
  }
  return `${pascal.charAt(0).toLowerCase()}${pascal.slice(1)}.tsx`;
}

function normalizeToSegments(input: string): string[] {
  return input.split("/").filter(Boolean);
}

export function normalizeRouteName(input: string): RouteNameMetadata {
  const cleaned = cleanInput(input);
  const pascal = toPascalCase(cleaned);
  const component = ensurePageSuffix(pascal || "NewRoute");
  const fileName = [ROUTES_ROOT, deriveFileNameFromPascal(pascal)].join("/");
  return { fileName, componentName: component };
}

export function normalizeNestedRouteName(
  parentPath: RouteNode,
  input: string,
): RouteNameMetadata {
  const raw = input.trim();
  const base = raw
    ? raw.replace(/^\//, "").replace(/[^a-zA-Z0-9[\]:_-]/g, "")
    : "new-subroute";
  const parentSegments = normalizeToSegments(parentPath.fullPath).map((segment) =>
    segment.replace(/[^a-zA-Z0-9]/g, ""),
  );
  const cleanedSegment = base.replace(/^:+/, "");
  const dirSegments = [...parentSegments, cleanedSegment.toLowerCase()];
  const filePath = [ROUTES_ROOT, ...dirSegments].join("/") + ".tsx";

  const pascalParent = parentSegments.map((segment) => toPascalCase(segment)).join("");
  const pascalChild = toPascalCase(cleanedSegment);
  const componentBase = (pascalParent + pascalChild).replace(/\d+/g, "") || "NestedRoute";
  const componentName = ensurePageSuffix(componentBase);

  return { fileName: filePath, componentName };
}

export function routePathToSegments(routePath: string): string[] {
  if (!routePath) return [];
  return routePath
    .split("/")
    .filter(Boolean)
    .map((segment) => sanitizeSegment(segment));
}

function sanitizeSegment(segment: string): string {
  if (!segment) return "";
  if (segment === "*") {
    return "[...all]";
  }
  if (segment.startsWith(":")) {
    const name = segment.slice(1).replace(/[^\w]/g, "");
    return name ? `[${name}]` : "[param]";
  }
  if (segment.startsWith("[") && segment.endsWith("]")) {
    return segment;
  }
  return segment;
}

export function buildRouteFileFromSegments(segments: string[]): string {
  if (!segments.length) {
    return `${ROUTES_ROOT}/index.tsx`;
  }

  return `${[ROUTES_ROOT, ...segments].join("/")}.tsx`;
}

export function buildRouteDirFromSegments(segments: string[]): string {
  return [ROUTES_ROOT, ...segments].join("/");
}

export function deriveComponentNameFromRoutePath(routePath: string): string {
  const segments = routePathToSegments(routePath);
  const pascal = segments.map((segment) => {
    const trimmed = segment.replace(/^(\[\.{3})?/, "").replace(/\]?$/, "");
    return toPascalCase(trimmed);
  });
  const base = pascal.join("") || "Page";
  return ensurePageSuffix(base);
}

export function deriveServiceInfo(routePath: string): {
  fileName: string;
  identifier: string;
  typeName: string;
} {
  const segments = routePathToSegments(routePath).filter(
    (segment) => !segment.startsWith("["),
  );
  const base =
    segments.length > 0 ? segments[segments.length - 1] : "resource";
  const cleaned = base.replace(/[^a-zA-Z0-9]/g, "") || "resource";
  const identifier = `${toPascalCase(cleaned)}Service`;
  const typeName = `${toPascalCase(cleaned)}Item`;
  const fileName = [SERVICES_ROOT, `${cleaned.toLowerCase()}.service.ts`].join("/");
  return { fileName, identifier, typeName };
}
