import type { FC } from 'react';
import { useState } from 'react';
import { disableDevtools } from '../core';
import type { RouterDevtoolsSnapshot } from '../types';
import { baseCardClass, monoClass } from './utils';

// --- ICONS (SVG inline, compatíveis com react) ---

type IconProps = {
  className?: string;
};

const ExternalLinkIcon: FC<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="12"
    height="12"
    className={props.className ?? 'w-3 h-3'}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 3h6v6" />
    <path d="M10 14L21 3" />
    <path d="M5 5h5" />
    <path d="M5 5v14h14v-5" />
  </svg>
);

const PencilIcon: FC<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="12"
    height="12"
    className={props.className ?? 'w-3 h-3'}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 2l4 4L8 20H4v-4L18 2z" />
    <path d="M16 4l4 4" />
  </svg>
);

const PlusIcon: FC<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="12"
    height="12"
    className={props.className ?? 'w-3 h-3'}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

// --- HELPERS GERAIS ---

async function openInEditor(filePath: string): Promise<void> {
  try {
    await fetch('/__opaca/devtools/open-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath }),
    });
  } catch (err) {
    console.error('[Devtools] open-route error', err);
    alert('Failed to open file in editor.');
  }
}

// --- ROUTE TREE TYPES / BUILDERS ---

type RouteNode = {
  name: string;
  fullPath: string;
  children: RouteNode[];
  isParam: boolean;
};

function buildRouteTree(routes: Record<string, string>): RouteNode[] {
  const root: RouteNode[] = [];

  Object.values(routes).forEach((path) => {
    if (path === '/' || path === '') {
      const existingRoot = root.find((n) => n.fullPath === '/');
      if (!existingRoot) {
        root.push({
          name: '/',
          fullPath: '/',
          children: [],
          isParam: false,
        });
      }
      return;
    }

    const parts = path.split('/').filter(Boolean);
    let current = root;

    parts.forEach((part, index) => {
      const isParam = part.startsWith(':');
      const existing = current.find((n) => n.name === part);

      if (existing) {
        current = existing.children;
      } else {
        const node: RouteNode = {
          name: part,
          isParam,
          fullPath: '/' + parts.slice(0, index + 1).join('/'),
          children: [],
        };
        current.push(node);
        current = node.children;
      }
    });
  });

  return root;
}

// --- HELPERS DE SCAFFOLD ---

function normalizeRouteName(input: string): {
  fileName: string;
  componentName: string;
} {
  const clean = input.replace(/[^a-zA-Z0-9-_]/g, '');

  if (!clean)
    return {
      fileName: 'src/routes/new-route.tsx',
      componentName: 'NewRoutePage',
    };

  const pascal = clean
    .toLowerCase()
    .replace(/(^\w|[-_]\w)/g, (m) => m.replace(/[-_]/, '').toUpperCase());

  const component = pascal.endsWith('Page') ? pascal : `${pascal}Page`;
  const fileName = `src/routes/${pascal.toLowerCase()}.tsx`;

  return { fileName, componentName: component };
}

function normalizeNestedRouteName(
  parent: RouteNode,
  input: string,
): { fileName: string; componentName: string } {
  const raw = input.trim();

  if (!raw) {
    return {
      fileName: 'src/routes/new-subroute.tsx',
      componentName: 'NewSubroutePage',
    };
  }

  const cleanedSegment = raw
    .replace(/^\//, '')
    .replace(/[^a-zA-Z0-9[\]:_-]/g, '');

  const isParamSegment =
    cleanedSegment.startsWith(':') || /^\[.+\]$/.test(cleanedSegment);

  let fsChildSegment = cleanedSegment;

  if (cleanedSegment.startsWith(':')) {
    fsChildSegment = `[${cleanedSegment.slice(1)}]`;
  }

  const parentPathSegments = parent.fullPath.split('/').filter(Boolean);

  const fsParentSegments = parentPathSegments.map((segment) =>
    segment.startsWith(':') ? `[${segment.slice(1)}]` : segment,
  );

  const fileName = `src/routes/${[
    ...fsParentSegments,
    fsChildSegment.toLowerCase(),
  ].join('/')}.tsx`;

  const toPascal = (value: string): string =>
    value
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .replace(/^:/, '')
      .split(/[-_]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('');

  const pascalParent = parentPathSegments.map(toPascal).join('');
  const pascalChild = toPascal(
    cleanedSegment || (isParamSegment ? 'Param' : 'Subroute'),
  );

  const baseName = pascalParent + pascalChild || 'NestedRoute';
  const componentName = baseName.endsWith('Page')
    ? baseName
    : `${baseName}Page`;

  return { fileName, componentName };
}

// --- UI COMPONENTS ---
type RouteAccordionItemProps = {
  node: RouteNode;
  depth: number;
  onCreateSubroute?: (node: RouteNode) => void;
  onGenerateCrud?: (node: RouteNode) => void;
};

const RouteAccordionItem: FC<RouteAccordionItemProps> = ({
  node,
  depth,
  onCreateSubroute,
  onGenerateCrud,
}) => {
  const [open, setOpen] = useState<boolean>(false);
  const hasChildren = node.children.length > 0;
  const indentPx = depth * 12;

  const isExpandable = hasChildren || node.isParam;

  const handleToggle = () => {
    if (!hasChildren) return;
    setOpen(!open);
  };

  const labelClass = `${monoClass} whitespace-nowrap ${
    node.isParam
      ? 'text-amber-200'
      : hasChildren
      ? 'text-sky-200'
      : 'text-emerald-200'
  }`;

  const cardClass = `flex items-center w-full min-w-0 rounded-md px-2 py-1.5 border transition-colors ${
    isExpandable
      ? 'border-emerald-500/60 bg-slate-900/90 hover:bg-slate-800/90 shadow-sm shadow-emerald-900/25 cursor-pointer'
      : 'border-slate-700/70 bg-slate-900/80 cursor-default'
  }`;

  return (
    <li className="flex flex-col text-[11.5px]">
      <div
        className="flex items-center gap-1"
        style={{ paddingLeft: `${indentPx}px` }}
      >
        {/* Botão principal (expandir/colapsar + label) */}
        <button type="button" onClick={handleToggle} className={cardClass}>
          {/* Chevron / bullet */}
          <span
            className={`inline-flex w-4 shrink-0 justify-center text-[10px] mr-1 ${
              hasChildren
                ? 'text-emerald-300'
                : node.isParam
                ? 'text-amber-300'
                : 'text-slate-500'
            }`}
          >
            {hasChildren ? (open ? '▾' : '▸') : node.isParam ? '◈' : '•'}
          </span>

          {/* Text container */}
          <span className="flex-1 min-w-0 flex items-center justify-between gap-2">
            {/* Route label */}
            <div className="flex items-center gap-2">
              <span className={labelClass}>
                {node.name === '/'
                  ? 'index'
                  : node.isParam
                  ? `<${node.name.replace(/^:/, '')}>`
                  : node.name}
              </span>

              {/* Full path */}
              <span
                className={`${monoClass} text-[10px] text-slate-500 break-all`}
              >
                {node.fullPath}
              </span>
            </div>

            {/* Badge para subrotas */}
            {hasChildren && (
              <span className="ml-1 inline-flex shrink-0 items-center rounded-full border border-sky-500/60 bg-sky-500/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.12em] text-sky-100">
                subroutes
              </span>
            )}
          </span>

          {/* Param badge */}
          {node.isParam && (
            <span className="ml-2 inline-flex shrink-0 items-center rounded-full border border-amber-400/60 bg-amber-500/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-100">
              param
            </span>
          )}
        </button>

        {/* Actions*/}
        <div className="flex items-center gap-1">
          <a
            href={node.fullPath}
            className="inline-flex items-center justify-center rounded-md border border-slate-600/60 bg-slate-900/80 p-2 text-[10px] text-slate-200 hover:bg-slate-700/80 transition-colors"
            title={`Open ${node.fullPath} in browser`}
            onClick={(event) => {
              event.stopPropagation();
              disableDevtools();
            }}
          >
            <ExternalLinkIcon className="w-3 h-3" />
          </a>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-emerald-500/70 bg-emerald-500/10 p-2 text-[10px] text-emerald-100 hover:bg-emerald-500/25 transition-colors cursor-pointer"
            title={`Open ${node.fullPath} in editor`}
            onClick={(event) => {
              event.stopPropagation();
              void openInEditor(node.fullPath);
            }}
          >
            <PencilIcon className="w-3 h-3" />
          </button>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-indigo-500/60 bg-indigo-500/10 text-[10px] px-2 py-1 text-indigo-100 hover:bg-indigo-500/25transition-colors cursor-pointer"
            title={`Generate CRUD & services for ${node.fullPath}`}
            onClick={(event) => {
              event.stopPropagation();
              if (onGenerateCrud) {
                void onGenerateCrud(node);
              }
            }}
          >
            <span className="font-semibold tracking-widest uppercase">
              CRUD
            </span>
          </button>

          {/* Create subroute button */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-sky-500/70 bg-sky-500/10 p-2 text-[10px] text-sky-100 hover:bg-sky-500/25 transition-colors cursor-pointer"
            title={`Create subroute inside ${node.fullPath}`}
            onClick={(event) => {
              event.stopPropagation();
              if (onCreateSubroute) {
                void onCreateSubroute(node);
              }
            }}
          >
            <PlusIcon className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Children */}
      {hasChildren && open && (
        <ul className="mt-1 flex flex-col gap-1 border-l border-slate-700/60 ml-2 pl-2">
          {node.children.map((child) => (
            <RouteAccordionItem
              key={child.fullPath + child.name}
              node={child}
              depth={depth + 1}
              onCreateSubroute={onCreateSubroute}
              onGenerateCrud={onGenerateCrud}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

type RouteTreeAccordionProps = {
  nodes: RouteNode[];
  onCreateSubroute?: (node: RouteNode) => void;
  onGenerateCrud?: (node: RouteNode) => void;
};

const RouteTreeAccordion: FC<RouteTreeAccordionProps> = ({
  nodes,
  onCreateSubroute,
  onGenerateCrud,
}) => {
  if (!nodes.length) {
    return (
      <div className="text-[11px] text-slate-500 italic">
        No routes registered.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {nodes.map((node) => (
        <RouteAccordionItem
          key={node.fullPath + node.name}
          node={node}
          depth={0}
          onCreateSubroute={onCreateSubroute}
          onGenerateCrud={onGenerateCrud}
        />
      ))}
    </ul>
  );
};

// --- MAIN TAB COMPONENT ---

type RouterTabProps = {
  router: RouterDevtoolsSnapshot | null;
};

export const RouterTab: FC<RouterTabProps> = ({ router }) => {
  const [isScaffolding, setIsScaffolding] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [success, setSuccess] = useState<null | string>(null);

  if (!router) {
    return (
      <section
        className={`${baseCardClass} flex-1 flex-col gap-3 flex items-center justify-center`}
      >
        <div className="text-slate-500 text-[11.5px]">
          No router snapshot available
        </div>
        <button
          className="
            mt-4  py-2 px-3 rounded-lg text-[11px] font-semibold 
            flex items-center justify-center gap-2
            border transition-all duration-150 ease-in-out

            bg-emerald-600/15 hover:bg-emerald-500/30 
            text-emerald-200 border-emerald-400/40 shadow-sm shadow-emerald-900/20
            active:scale-[0.97]
            focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:ring-offset-2 focus:ring-offset-slate-900
            disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
          "
          onClick={() => window.location.reload()}
        >
          Refresh
        </button>
      </section>
    );
  }

  const routesTree = buildRouteTree(router.routes || {});
  const totalRoutes = Object.keys(router.routes || {}).length;

  async function handleScaffoldRoute(
    path: string,
    name: string,
  ): Promise<void> {
    setIsScaffolding(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/__opaca/devtools/scaffold-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path,
          name,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error ?? 'Scaffold failed: unknown error');
      }

      setSuccess(`Created: ${data.path}`);
    } catch (err: any) {
      setError(err?.message ?? 'Unknown error');
    } finally {
      setIsScaffolding(false);
    }
  }

  async function handleCreateRoute() {
    const input = prompt(
      'Enter route name (e.g. posts, user-settings, dashboard):',
    );

    if (!input) {
      return;
    }

    const { fileName, componentName } = normalizeRouteName(input);
    await handleScaffoldRoute(fileName, componentName);
  }

  async function handleCreateSubroute(parent: RouteNode) {
    const input = prompt(
      `Enter subroute name for "${parent.fullPath}" (e.g. details, :id, settings):`,
    );

    if (!input) {
      return;
    }

    const { fileName, componentName } = normalizeNestedRouteName(parent, input);
    await handleScaffoldRoute(fileName, componentName);
  }

  async function handleGenerateCrud(node: RouteNode) {
    try {
      setIsScaffolding(true);
      setError(null);
      setSuccess(null);

      const res = await fetch('/__opaca/devtools/scaffold-crud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routePath: node.fullPath,
          // se quiser permitir customizar via prompt:
          // resourceName: prompt('Resource name (default from route):') || undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error ?? 'Scaffold CRUD failed');
      }

      setSuccess(
        `CRUD generated: ${data.moduleFile} & ${data.serviceFile} (and api.ts patched)`,
      );
    } catch (err: any) {
      console.error('[Devtools] scaffold-crud error', err);
      setError(err?.message ?? 'Unknown error');
    } finally {
      setIsScaffolding(false);
    }
  }

  return (
    <section className={`${baseCardClass} flex-1 flex flex-col min-h-0`}>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-300">
        Router State
      </div>

      <div className="flex flex-col gap-2 text-[11.5px]">
        {/* Current route info */}
        <div className="flex items-start gap-2">
          <span className="font-semibold text-slate-400 min-w-[60px]">
            Path:
          </span>
          <span className={`${monoClass} text-emerald-200`}>
            {router.currentPath}
          </span>
        </div>
        <div className="flex items-start gap-2 break-all">
          <span className="font-semibold text-slate-400 min-w-[60px]">
            Params:
          </span>
          <span className={monoClass}>{JSON.stringify(router.params)}</span>
        </div>
        <div className="flex items-start gap-2 break-all">
          <span className="font-semibold text-slate-400 min-w-[60px]">
            Search:
          </span>
          <span className={monoClass}>{JSON.stringify(router.search)}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-semibold text-slate-400 min-w-[60px]">
            Hash:
          </span>
          <span className={monoClass}>{router.hash ?? '-'}</span>
        </div>

        {/* Summary */}
        <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            Total Routes:{' '}
            <span className="font-semibold text-slate-200">{totalRoutes}</span>
          </div>
        </div>

        {/* Routes tree accordion */}
        <div className="mt-2 pt-2 border-t border-slate-700/50">
          <div className="mb-1 text-[11px] font-semibold text-slate-300">
            Routes Tree
          </div>
          <RouteTreeAccordion
            nodes={routesTree}
            onCreateSubroute={handleCreateSubroute}
            onGenerateCrud={handleGenerateCrud}
          />
        </div>

        {/* Create new route button (root) */}
        <button
          type="button"
          onClick={handleCreateRoute}
          disabled={isScaffolding}
          className="
            mt-4 w-full py-2 px-3 rounded-lg text-[11px] font-semibold 
            flex items-center justify-center gap-2
            border transition-all duration-150 ease-in-out

            bg-emerald-600/15 hover:bg-emerald-500/30 
            text-emerald-200 border-emerald-400/40 shadow-sm shadow-emerald-900/20
            active:scale-[0.97]
            focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:ring-offset-2 focus:ring-offset-slate-900
            disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
          "
        >
          {isScaffolding ? (
            <span className="animate-pulse">Scaffolding...</span>
          ) : (
            <>
              <span className="text-xs">＋</span>
              <span>Create New Route</span>
            </>
          )}
        </button>

        {/* Feedback messages */}
        {success && (
          <div className="mt-2 text-[11px] text-emerald-300">{success}</div>
        )}

        {error && (
          <div className="mt-2 text-[11px] text-red-300">Error: {error}</div>
        )}
      </div>
    </section>
  );
};
