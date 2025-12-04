import { createRoute, type RouteContext } from 'opaca';
import { useState } from 'react';

const BlogPage = createRoute((ctx: RouteContext) => {
  const [count, setCount] = useState(0);

  return (
    <main className="bg-[#0d0d0d] text-slate-100 flex items-center justify-center px-6">
      Blog page
    </main>
  );
});

export default BlogPage;
