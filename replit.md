# WebSpecs

Self-hosted analytics that classifies page requests as human traffic, crawlers, AI training crawlers, agent fetches, or suspicious browser traffic.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the local API service (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env for PostgreSQL: `DATABASE_URL`
- Required env for privacy-preserving IP hashing: `WEBSPECS_HASH_SALT`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/webspecs-classifier` — dependency-free classifier and checked-in signatures/ranges
- `lib/webspecs-middleware` — Express request logger with storage callback
- `lib/webspecs-snippet` — framework-free browser signal
- `lib/db/src/schema` — PostgreSQL and SQLite event/rollup schemas
- `README.md` — adoption instructions and plain-language classification rules

## Architecture decisions

- The classifier and middleware are separate packages so adopters can use either without the dashboard or storage layer.
- IPs are hashed with an adopter-owned salt; raw IPs are not part of the event schema.
- Known User-Agent matches classify immediately; browser signals only refine unmatched page loads.
- Signature lists and datacenter ranges are local reviewed files, never remote runtime dependencies.

## Product

The first build provides the local request and browser-signal foundations. A local dashboard will query hourly rollups in the next phase.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm run typecheck` after changing any shared library.
- Do not add remote telemetry or runtime signature downloads to the default path.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
