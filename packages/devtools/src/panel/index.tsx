import {
  $devtoolsEnabled,
  $logs,
  $mutations,
  $queries,
  disableDevtools,
  enableDevtools,
} from '../core';

import { useStore } from '@nanostores/react';
import { useState } from 'react';
import { DevtoolsDock } from './dock';
import { LogsTab } from './logs';
import { MutationsTab } from './mutations';
import { QueriesTab } from './queries';
import { RouterTab } from './router';

type DevtoolsTab = 'router' | 'queries' | 'mutations' | 'logs';

export const DevtoolsPanel = () => {
  const isOpen = useStore($devtoolsEnabled);

  const queries = useStore($queries) || {};
  const mutations = useStore($mutations) || {};
  const logs = useStore($logs) || [];

  const [tab, setTab] = useState<DevtoolsTab>('router');

  function handleOpenChange(next: boolean) {
    if (next) {
      enableDevtools();
    } else {
      disableDevtools();
    }
  }

  if (process.env.NODE_ENV && process.env.NODE_ENV === 'production')
    return null;

  return (
    <DevtoolsDock open={!!isOpen} onOpenChange={handleOpenChange} width={420}>
      {!isOpen ? null : (
        <div className="h-full w-full text-slate-200 text-[12px] flex flex-col overflow-hidden">
          {/* Header */}
          <header className="px-3 py-2 border-b border-slate-700 bg-slate-950 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-slate-300">
                Opaca Devtools
              </div>
              {/* <div
                className={`${monoClass} text-[11px] ${
                  router ? 'text-indigo-300' : 'text-slate-500'
                } whitespace-nowrap overflow-hidden text-ellipsis`}
                title={router?.currentPath}
              >
                {router ? router.currentPath : 'no route'}
              </div> */}
            </div>
          </header>

          {/* Tabs */}
          <div className="flex items-center border-b border-slate-700 bg-slate-900/95">
            {(['router', 'queries', 'mutations', 'logs'] as DevtoolsTab[]).map(
              (t) => {
                const isActive = tab === t;
                const base =
                  'flex-none px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer border transition-all';

                const activeClasses: Record<DevtoolsTab, string> = {
                  router:
                    'border-emerald-500/80 bg-emerald-700/20 text-emerald-100 shadow-sm',
                  queries:
                    'border-blue-500/80 bg-blue-700/20 text-blue-100 shadow-sm',
                  mutations:
                    'border-violet-500/80 bg-violet-700/20 text-violet-100 shadow-sm',
                  logs: 'border-amber-500/80 bg-amber-700/20 text-amber-100 shadow-sm',
                };

                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={
                      base +
                      ' ' +
                      (isActive
                        ? activeClasses[t]
                        : 'border-transparent text-slate-400 hover:text-slate-100 hover:border-slate-700')
                    }
                  >
                    {t === 'router' && 'Router'}
                    {t === 'queries' && 'Queries'}
                    {t === 'mutations' && 'Mutations'}
                    {t === 'logs' && 'Logs'}
                  </button>
                );
              },
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-hidden flex flex-col gap-2">
            {tab === 'router' && (
              <RouterTab
                router={{
                  params: {},
                  currentPath: '',
                  routes: {},
                  routesMeta: {},
                  search: {},
                  hash: '',
                }}
              />
            )}
            {tab === 'queries' && <QueriesTab queries={queries} />}
            {tab === 'mutations' && <MutationsTab mutations={mutations} />}
            {tab === 'logs' && <LogsTab logs={logs as any[]} />}
          </div>
        </div>
      )}
    </DevtoolsDock>
  );
};
