# Opaca → Cloudflare Worker

Use the builder in this folder to turn a Opaca project into a Worker ready to deploy on Cloudflare.

## Prerequisites

- Run the commands from the app directory (e.g. `apps/playground`) so that `opaca.config.ts` is resolved correctly.
- Run `opaca codegen` (or the `opaca:codegen` script) before starting the build to make sure `.opaca/` is up to date.

## How to use

```bash
# inside the app
bun run ../../packages/opaca-dev/src/builder/cloudflare-cli.ts --config opaca.config.ts
```

Useful options:

* `--dev`: disables minification and cache headers to make debugging easier.
* `--out <dir>`: changes the output directory (default: `<outDir>/cloudflare`).
* `--assets-base <path>`: changes the public prefix for assets (default: `/_buna/assets`).
* `--skip-codegen`: skips running `generateRoutes` automatically (if you’ve already executed it).
* Using Tailwind via `<link href="tailwindcss" />` requires `bun-plugin-tailwind` + `tailwindcss` to be installed in your app (the builder will compile and include the generated CSS automatically).

The command generates:

* A worker (`worker.js`) containing all HTML routing and in-memory assets.
* Bundles for the `.tsx` files imported from the generated HTML files.

Then just deploy the resulting `worker.js` to Cloudflare Workers.
