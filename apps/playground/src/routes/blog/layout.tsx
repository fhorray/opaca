import type { ReactNode } from 'react';

const BlogLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="h-screen w-full bg-[#050505] text-slate-100 flex flex-col px-6">
      <div className="mb-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
          Blog area
        </p>
        <h2 className="text-2xl font-semibold text-slate-50">Latest entries</h2>
      </div>
      {children}
    </div>
  );
};

export default BlogLayout;
