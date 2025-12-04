import React from 'react';

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="h-screen flex flex-col bg-[#0d0d0d] text-slate-100 font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#111]/80 backdrop-blur-lg supports-backdrop-filter:bg-[#111]/50">
        <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between">
          {/* Branding */}
          <a href="/">
            <span className="inline-flex items-center justify-center p-2 bg-emerald-500/10 text-sm font-semibold">
              opaca<span className="text-emerald-400">()</span>
            </span>
          </a>

          {/* Navigation  */}
          <nav className="hidden md:flex items-center gap-6 text-xs text-slate-400">
            <a href="/" className="hover:text-slate-100 transition">
              Home
            </a>
            <a href="#" className="hover:text-slate-100 transition">
              Documentation
            </a>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-[#0d0d0d]">
        <div className="mx-auto max-w-6xl px-5 py-6 text-xs text-slate-500">
          <p className="tracking-wide">
            Built with opaca() for Cloudflare Workers
          </p>
          <p className="mt-1 opacity-60">
            RouterView acts as the root layout wrapper. Every route is rendered
            inside here.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
