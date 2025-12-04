export type DevtoolsStatus = 'idle' | 'loading' | 'success' | 'error';

export type DevtoolsQueryKey = readonly unknown[];

export type DevtoolsQuerySnapshot = {
  id: string;
  key: DevtoolsQueryKey;
  status: DevtoolsStatus;
  data?: unknown;
  error?: unknown;
  updatedAt: number;
};

export type RouterDevtoolsSnapshot = {
  currentPath: string;
  params: Record<string, string>;
  search: Record<string, string>;
  hash?: string;
  routes: Record<string, string>;
  routesMeta: Record<
    string,
    {
      pattern: string;
      directory: string;
      filePath: string;
    }
  >;
};

export type DevtoolsLogLevel = 'info' | 'warn' | 'error' | 'debug';

export type DevtoolsLogSource =
  | 'router'
  | 'query'
  | 'mutation'
  | 'plugin'
  | 'app';

export type DevtoolsLogEntry = {
  id: string;
  level: DevtoolsLogLevel;
  source: DevtoolsLogSource;
  message: string;
  payload?: unknown;
  createdAt: number;
};

export type DevtoolsMutationSnapshot = {
  id: string;
  key: DevtoolsQueryKey;
  status: DevtoolsStatus;
  variables?: unknown;
  data?: unknown;
  error?: unknown;
  updatedAt: number;
};