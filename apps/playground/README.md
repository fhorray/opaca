# Opaca Playground

## Installation

```bash
bun install
```

## App scripts (`apps/playground`)

| Command                | Description                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run opaca:prepare` | Cleans `.opaca`, regenerates the routes (`opaca codegen`), and recreates the hidden runner in `.opaca/build.ts`.                                       |
| `bun run dev`          | Runs `opaca:prepare` and starts the server with `bun --hot src/entry.ts`. Use this command (or `opaca dev`) to avoid `#opaca/routes.generated` errors. |
| `bun run build`        | Runs `opaca:prepare` and executes `.opaca/build.ts`, respecting the selected target (`bun`, `node`, or `cloudflare`).                                 |
| `bun run check-types`  | Runs `tsc --noEmit` to check types in the playground.                                                                                               |

## Global monorepo commands

All commands below must be executed from the root directory (`/opaca`):

| Command | Description |
| ------- | ----------- |
| `opaca dev` | Runs Turborepo in development mode (apps + packages) and calls each workspace’s `opaca:prepare`. |
| `opaca build --runtime <bun\|node\|cloudflare>` | Runs the full build pipeline (packages + apps). When `cloudflare` is selected the worker bundle is written to `.opaca/cloudflare`. |
| `opaca build` | Same as above but the runtime is chosen interactively via the CLI prompts. |
| `opaca check-types` | Runs `tsc --noEmit` across all workspaces. |
| `opaca codegen --config apps/playground/opaca.config.ts` | Manually regenerates `.opaca/routes.generated.ts`. Usually called by `opaca:prepare`. |

## Cloudflare bundle layout

Running `opaca build --runtime cloudflare` creates the worker payload at `.opaca/cloudflare/` with the following files:

- `worker.js`: the request handler that proxies asset fetches to Wrangler’s `ASSETS` binding and serves the compiled HTML.
- `assets/`: hashed JS/CSS bundles **plus** any relative static assets referenced by the HTML (images, favicons, media); everything is exposed through the `ASSETS` binding declared in `wrangler.jsonc`.
- `pages/`: HTML snapshots emitted from `.opaca/pages` for visibility/debugging.
- Use `apps/playground/wrangler.jsonc` (already pointing to these locations) to run `wrangler dev` or `wrangler deploy`.

## Notes

* Always use `bun run dev` (or `opaca dev`) during development, as this ensures `.opaca` is recreated before starting the server.
* Worker artifacts are located in `.opaca/cloudflare`. Run `opaca build --runtime cloudflare` to regenerate them whenever routes or assets change.
