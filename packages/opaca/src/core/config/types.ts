export type BunaRoute = Record<string, Bun.HTMLBundle>

export interface BunaConfig {
  routesDir: string;
  outDir: string;
}

export interface ResolvedBunaConfig {
  routesDir: string;
  outDir: string;
  routes?: BunaRoute;
}
