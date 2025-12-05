import { createRoute, type RouteContext } from 'opaca';

const TestPage = createRoute((ctx: RouteContext) => {
  return (
    <main className="min-h-screen grid place-items-center bg-slate-950 text-white">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
          Opaca route
        </p>
        <h1 className="text-2xl font-bold text-emerald-200">
          Route path: src/routes/test.tsx
        </h1>
      </div>
    </main>
  );
});

export default TestPage;
