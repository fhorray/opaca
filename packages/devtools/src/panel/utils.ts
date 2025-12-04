export const baseCardClass =
  'bg-slate-950 p-4';

export const monoClass = 'font-mono text-[11px]';

export const badgeClass =
  'inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.08em]';

export function getStatusClasses(status?: string): string {
  const normalized = (status || '').toLowerCase();

  if (normalized === 'success') {
    return 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/60';
  }

  if (normalized === 'error' || normalized === 'failed') {
    return 'bg-red-500/10 text-red-100 border border-red-400/60';
  }

  if (normalized === 'loading' || normalized === 'pending') {
    return 'bg-blue-500/10 text-blue-100 border border-blue-400/60';
  }

  if (normalized === 'idle') {
    return 'bg-slate-500/10 text-slate-200 border border-slate-400/60';
  }

  return 'bg-gray-600/15 text-gray-300 border border-gray-600/60';
}

export type QueryStatusFilter = 'all' | 'success' | 'error' | 'loading' | 'idle';
export type HttpMethodFilter = 'all' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OTHER';
export type LogLevelFilter = 'all' | 'debug' | 'info' | 'warn' | 'error';

export function matchMethodFilter(methodRaw: unknown, filter: HttpMethodFilter): boolean {
  const method = String(methodRaw ?? '').toUpperCase();
  if (filter === 'all') return true;

  if (filter === 'OTHER') {
    const known = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    return !known.includes(method);
  }

  return method === filter;
}

export function matchStatusFilter(statusRaw: unknown, filter: QueryStatusFilter): boolean {
  if (filter === 'all') return true;
  const status = String(statusRaw || '').toLowerCase();

  if (filter === 'success') return status === 'success';
  if (filter === 'idle') return status === 'idle';
  if (filter === 'loading') return status === 'loading' || status === 'pending';
  if (filter === 'error') return status === 'error' || status === 'failed';

  return true;
}

export function matchSearch(termRaw: string, ...fields: Array<unknown>): boolean {
  const term = termRaw.toLowerCase().trim();
  if (!term) return true;

  return fields.some((f) =>
    String(f ?? '')
      .toLowerCase()
      .includes(term),
  );
}
