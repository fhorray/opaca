import { serve } from "bun";
import { routes } from "#opaca/routes.generated";
import { handleRequest } from "opaca/runtime";
import { withDevtools } from "@opaca/devtools";
import config from "@/opaca.config";

const devHandleRequest = withDevtools(handleRequest);

const server = serve({
  routes,
  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
  fetch(req, server) {
    const env: any = {};
    const ctx = { waitUntil: (_p: Promise<any>) => { } };
    return devHandleRequest(req, env, ctx, config);
  },
});

console.log(`🚀 Server running at ${server.url}`);
