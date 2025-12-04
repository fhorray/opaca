import type { ReactNode } from "react";
import type { RouteContext } from "./create-route";

const LAYOUTS_SYMBOL = Symbol.for("__BUNA_PENDING_LAYOUTS__");

export type BunaLayoutComponent<C extends RouteContext = RouteContext> = (props: {
  children: ReactNode;
  ctx?: C;
}) => ReactNode;

type GlobalWithLayouts = typeof globalThis & {
  [LAYOUTS_SYMBOL]?: BunaLayoutComponent[];
};

/**
 * Register the layout components that should wrap the next route module that loads.
 * Entry files call this before dynamically importing the user route.
 */
export function registerPendingLayouts(layouts: BunaLayoutComponent[]) {
  if (typeof window === "undefined") return;
  const globalTarget = globalThis as GlobalWithLayouts;
  globalTarget[LAYOUTS_SYMBOL] = layouts;
}

/**
 * Consume and clear the pending layouts registered for the next route module.
 */
export function consumePendingLayouts<C extends RouteContext = RouteContext>():
  | BunaLayoutComponent<C>[]
  | undefined {
  const globalTarget = globalThis as GlobalWithLayouts;
  const layouts = globalTarget[LAYOUTS_SYMBOL] as BunaLayoutComponent<C>[] | undefined;
  if (layouts) {
    delete globalTarget[LAYOUTS_SYMBOL];
  }
  return layouts;
}
