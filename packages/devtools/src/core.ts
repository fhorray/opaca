import { atom, map } from 'nanostores';
import type {
  DevtoolsQueryKey,
  DevtoolsQuerySnapshot,
  RouterDevtoolsSnapshot,
  DevtoolsLogEntry,
  DevtoolsMutationSnapshot,
} from './types';
import { persistentAtom } from '@nanostores/persistent';


// Enable flag (only used in dev)
export const $devtoolsEnabled = persistentAtom<boolean>(
  'devtoolsEnabled',
  typeof import.meta !== 'undefined'
    ? !!(import.meta as any).env?.DEV
    : true,
  {
    encode(value) {
      return JSON.stringify(value); // always encode as JSON
    },
    decode(value) {
      try {
        return JSON.parse(value) as boolean;
      } catch {
        return true; // fallback default
      }
    },
  },
);

// All queries keyed by an id
export const $queries = map<Record<string, DevtoolsQuerySnapshot>>({});

// Mutations
export const $mutations = map<Record<string, DevtoolsMutationSnapshot>>({});

// Current router snapshot
export const $router = atom<RouterDevtoolsSnapshot | null>(null);

// Logs
export const $logs = atom<DevtoolsLogEntry[]>([]);

// Small helper to generate a stable id from query key
export function devtoolsKeyToId(keyParts: DevtoolsQueryKey): string {
  try {
    return JSON.stringify(keyParts);
  } catch {
    return String(keyParts[0] ?? 'unknown-key');
  }
}

// Update or insert a query snapshot
export function upsertQuerySnapshot(
  id: string,
  snapshot: Partial<DevtoolsQuerySnapshot> & { key: DevtoolsQueryKey },
): void {
  if (!$devtoolsEnabled.get()) return;

  const current = $queries.get()[id];

  const next: DevtoolsQuerySnapshot = {
    ...current,
    ...snapshot,
    id,
    status: 'idle',
    updatedAt: Date.now(),

  };

  $queries.setKey(id, next);
}

// Set router snapshot
export function setRouterSnapshot(snapshot: RouterDevtoolsSnapshot): void {
  if (!$devtoolsEnabled.get()) return;
  $router.set({
    ...snapshot,
    // always update time implicitly via queries if needed later
  });
}

export function appendLog(
  entry: Omit<DevtoolsLogEntry, 'id' | 'createdAt'>,
): void {
  if (!$devtoolsEnabled.get()) return;

  const log: DevtoolsLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
    ...entry,
  };

  const current = $logs.get();
  const next = [...current, log].slice(-300); // limita a 300
  $logs.set(next);
}

export function upsertMutationSnapshot(
  id: string,
  snapshot: Partial<DevtoolsMutationSnapshot> & { key: DevtoolsQueryKey },
): void {
  if (!$devtoolsEnabled.get()) return;

  const current = $mutations.get()[id];

  const next: DevtoolsMutationSnapshot = {
    ...current,
    ...snapshot,
    id,
    status: 'idle',
    updatedAt: Date.now(),

  };

  $mutations.setKey(id, next);
}


// TOGGLES
export function toggleDevtools(): void {
  $devtoolsEnabled.set(!$devtoolsEnabled.get());
}

// Forçar abrir
export function enableDevtools(): void {
  $devtoolsEnabled.set(true);
}

// Forçar fechar
export function disableDevtools(): void {
  $devtoolsEnabled.set(false);
}