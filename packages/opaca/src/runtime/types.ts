export interface BunaEnv {
  [key: string]: unknown;
}

export interface BunaExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

