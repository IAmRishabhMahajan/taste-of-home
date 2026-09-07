# A Taste of Home RSVP

A warm Friendsgiving RSVP experience that helps guests choose an available dish category, share dietary details, and add the story behind what they bring.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/taste-of-home/src/App.tsx` — guest RSVP flow and organiser overview
- `artifacts/taste-of-home/src/index.css` — parchment, evergreen, persimmon, and typography theme
- `lib/api-spec/openapi.yaml` — source of truth for availability and RSVP contracts
- `lib/db/src/schema/rsvps.ts` — persisted RSVP shape
- `artifacts/api-server/src/routes/event.ts` — live category balancing and RSVP endpoints

## Architecture decisions

- Dish categories are defined as event configuration on the API and availability is derived from submitted RSVPs.
- Guests only receive categories with remaining capacity; the API re-checks capacity on submit to avoid stale selections.
- The organiser view reads the same availability and RSVP endpoints as the guest flow, keeping the table plan consistent.

## Product

- Guests can RSVP yes or no, add their party size, share dietary requirements, choose from currently needed categories, and tell the origin story of their dish.
- Hosts can see live category balance, confirmed headcount, dish stories, dietary notes, and the submitted guest list.

## User preferences

The invitation and website should feel like one connected keepsake: warm, tactile, and story-led rather than administrative.

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`.
- Keep the API server and the web artifact workflows running together for the live availability flow.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
