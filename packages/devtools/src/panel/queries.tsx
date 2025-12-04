import type { FC } from 'react';
import { useState } from 'react';

import {
  baseCardClass,
  monoClass,
  badgeClass,
  getStatusClasses,
  matchMethodFilter,
  matchStatusFilter,
  matchSearch,
  type QueryStatusFilter,
  type HttpMethodFilter,
} from './utils';

type QueriesTabProps = {
  queries: Record<string, any>;
};

export const QueriesTab: FC<QueriesTabProps> = ({ queries }) => {
  const [expandedQueryId, setExpandedQueryId] = useState<string | null>(null);
  const [querySearch, setQuerySearch] = useState('');
  const [queryStatusFilter, setQueryStatusFilter] =
    useState<QueryStatusFilter>('all');
  const [queryMethodFilter, setQueryMethodFilter] =
    useState<HttpMethodFilter>('all');

  const queriesList = Object.values(queries) as any[];

  const filteredQueries = queriesList
    .slice()
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .filter((q) => {
      const key = (q.key || []) as any[];
      const method = key[0];
      const path = key[1];

      if (!matchMethodFilter(method, queryMethodFilter)) return false;
      if (!matchStatusFilter(q.status, queryStatusFilter)) return false;

      return matchSearch(querySearch, method, path, JSON.stringify(q.key));
    });

  return (
    <section className={`${baseCardClass} flex-1 flex flex-col min-h-0`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-300">
          Queries
        </span>
        <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
          {filteredQueries.length} / {queriesList.length}
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5 mb-2 items-center">
        <input
          type="text"
          placeholder="Search key / path..."
          value={querySearch}
          onInput={(e) => setQuerySearch((e.currentTarget as any).value)}
          className="flex-1 min-w-[120px] rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[11px] text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500/50 transition-colors"
        />

        <select
          value={queryMethodFilter}
          onInput={(e) =>
            setQueryMethodFilter(
              (e.currentTarget as any).value as HttpMethodFilter,
            )
          }
          className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] outline-none cursor-pointer hover:border-slate-600 transition-colors"
        >
          <option value="all">Method: All</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
          <option value="OTHER">Other</option>
        </select>

        <select
          value={queryStatusFilter}
          onInput={(e) =>
            setQueryStatusFilter(
              (e.currentTarget as any).value as QueryStatusFilter,
            )
          }
          className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] outline-none cursor-pointer hover:border-slate-600 transition-colors"
        >
          <option value="all">Status: All</option>
          <option value="success">Success</option>
          <option value="loading">Loading</option>
          <option value="idle">Idle</option>
          <option value="error">Error</option>
        </select>
      </div>

      {filteredQueries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-[11.5px] text-center px-4">
          {queriesList.length === 0
            ? 'No queries recorded yet'
            : 'No queries match this filter'}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 overflow-auto">
          {filteredQueries.map((q) => {
            const key = (q.key || []) as any[];
            const method = key[0] ?? 'UNKNOWN';
            const path = key[1] ?? '';
            const isExpanded = expandedQueryId === q.id;
            const status = String(q.status || 'unknown');

            return (
              <div
                key={q.id}
                className={`${baseCardClass} px-2.5 py-2 hover:border-slate-600 transition-colors`}
              >
                {/* Header */}
                <div
                  className="flex justify-between items-center gap-2 cursor-pointer"
                  onClick={() => setExpandedQueryId(isExpanded ? null : q.id)}
                >
                  <div className="flex flex-col min-w-0">
                    <span
                      className={`${monoClass} text-[11px] uppercase tracking-[0.08em] font-bold text-blue-400`}
                    >
                      {String(method)}
                    </span>
                    <span
                      className={`${monoClass} text-[11px] text-slate-100 whitespace-nowrap overflow-hidden text-ellipsis`}
                      title={String(path)}
                    >
                      {String(path) || '(no key path)'}
                    </span>
                    <span className="text-[10px] text-slate-500 break-all mt-0.5">
                      {JSON.stringify(q.key)}
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`${badgeClass} ${getStatusClasses(
                          q.status,
                        )}`}
                      >
                        {status}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {q.updatedAt
                          ? new Date(q.updatedAt).toLocaleTimeString()
                          : '-'}
                      </span>
                      <span className="text-[14px] leading-none text-slate-400">
                        {isExpanded ? '▾' : '▸'}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.alert('TODO: INVALIDATE LOGIC');
                        }}
                        className="px-2 py-0.5 rounded-full border text-[10px] border-slate-600 hover:bg-slate-800 transition-colors"
                      >
                        Invalidate
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.alert('TODO: REFETCH LOGIC');
                        }}
                        className="px-2 py-0.5 rounded-full border text-[10px] border-blue-500/70 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                      >
                        Refetch
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-slate-700 flex flex-col gap-2">
                    <div>
                      <div className="text-[10px] font-semibold text-slate-300 mb-0.5 uppercase tracking-wide">
                        Data
                      </div>
                      <pre
                        className={`${monoClass} bg-slate-950 rounded-lg p-2 border border-slate-700 max-h-40 overflow-auto text-slate-100`}
                      >
                        {q.data == null
                          ? 'null'
                          : JSON.stringify(q.data, null, 2)}
                      </pre>
                    </div>

                    {q.error && (
                      <div>
                        <div className="text-[10px] font-semibold text-rose-300 mb-0.5 uppercase tracking-wide">
                          Error
                        </div>
                        <pre
                          className={`${monoClass} bg-slate-900 rounded-lg p-2 border border-rose-900/80 max-h-40 overflow-auto text-rose-100`}
                        >
                          {JSON.stringify(q.error, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
