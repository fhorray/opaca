import { createRoute, type RouteContext } from 'opaca';
import { useState } from 'react';
import logoUrl from '@public/logo.svg';

const AboutPage = createRoute((ctx: RouteContext) => {
  const [count, setCount] = useState(0);

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-slate-100 flex items-center justify-center px-6">
      <div className="w-full flex justify-center flex-col gap-4 max-w-xl text-center">
        <img
          src={logoUrl}
          alt="Opaca logo"
          width={100}
          className="self-center"
        />
        {/* Intro */}
        <h1 className="text-4xl font-semibold tracking-tight mb-3">
          Welcome to <span className="text-emerald-400">opaca()</span>
        </h1>
        <p className="text-slate-400">
          Start editing{' '}
          <code className="px-1.5 py-0.5 bg-slate-800 rounded text-emerald-300">
            src/routes/index.tsx
          </code>{' '}
          to begin.
        </p>

        {/* Interactive Example */}
        <div className="mt-10 border border-slate-700 bg-slate-800/50 rounded-xl p-6 shadow-lg">
          <p className="text-xs uppercase tracking-wider text-slate-400 mb-4">
            Interactive example
          </p>

          <div className="flex flex-col gap-4 items-center justify-between">
            <span className="text-3xl font-medium tabular-nums">{count}</span>

            <button
              onClick={() => setCount((prev: number) => prev + 1)}
              className="px-4 py-2 text-sm rounded-lg border border-emerald-400/70 bg-emerald-500/80 text-slate-950 hover:bg-emerald-400 transition cursor-pointer"
            >
              Increment
            </button>
          </div>

          <button
            onClick={() => setCount(0)}
            className="block mx-auto mt-4 text-sm text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            Reset
          </button>
        </div>

        {/* Footer */}
        <p className="mt-10 text-xs text-slate-500">
          Built using opaca() + Tailwind
        </p>
      </div>
    </main>
  );
});

AboutPage.meta = {
  title: 'About - Opaca Playground',
  description: 'Example about page using Opaca createRoute.',
  keywords: ['opaca', 'playground', 'about'],
  htmlLang: 'en',
  robots: {
    index: true,
    follow: true,
  },
  canonicalUrl: 'https://example.com/about',
  openGraph: {
    title: 'About Opaca Playground',
    description: 'Example about page using Opaca createRoute.',
    url: 'https://example.com/about',
    siteName: 'Opaca Playground',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About Opaca Playground',
    description: 'Example about page using Opaca createRoute.',
  },
};

export default AboutPage;
