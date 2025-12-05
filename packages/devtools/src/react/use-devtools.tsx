import { useStore } from '@nanostores/react';
import {
  $logs,
  $mutations,
  $queries,
  $router,
  $devtoolsEnabled,
  appendLog,
  upsertMutationSnapshot,
  upsertQuerySnapshot,
  setRouterSnapshot,
  toggleDevtools,
  enableDevtools,
  disableDevtools,
} from '../core';

export const useDevtools = () => {
  const logs = useStore($logs);
  const mutations = useStore($mutations);
  const queries = useStore($queries);
  const router = useStore($router);
  const devtoolsEnabled = useStore($devtoolsEnabled);

  return {
    getters: {
      logs,
      mutations,
      queries,
      router,
      devtoolsEnabled,
    },
    setters: {
      // High-level helpers that já respeitam o flag de devtools
      appendLog,
      upsertQuerySnapshot,
      upsertMutationSnapshot,
      setRouterSnapshot,
      toggleDevtools,
      enableDevtools,
      disableDevtools,

      // Setters diretos de estado bruto (se precisar)
      setLogs(nextLogs: typeof logs) {
        $logs.set(nextLogs);
      },
      clearLogs() {
        $logs.set([]);
      },

      setQueries(nextQueries: typeof queries) {
        $queries.set(nextQueries);
      },
      clearQueries() {
        $queries.set({});
      },

      setMutations(nextMutations: typeof mutations) {
        $mutations.set(nextMutations);
      },
      clearMutations() {
        $mutations.set({});
      },

      setRouter(nextRouter: typeof router) {
        $router.set(nextRouter);
      },
      resetRouter() {
        $router.set(null);
      },
    },
  };
};
