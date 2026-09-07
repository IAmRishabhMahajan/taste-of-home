# Deploying to Vercel

The frontend (static Vite build) and the API (Express, bundled to a single
serverless function) deploy together from this repo. Config lives in
[`vercel.json`](vercel.json); the function entry is [`api/index.mjs`](api/index.mjs).

## 1. Provision a Postgres database

Any Postgres works. Free option: [Neon](https://neon.tech) → new project →
copy the **pooled** connection string (looks like
`postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`).

## 2. Create the table

```bash
psql "<your DATABASE_URL>" -f scripts/schema.sql
```

or paste [`scripts/schema.sql`](scripts/schema.sql) into the Neon SQL editor.

## 3. Deploy

```bash
npx vercel login
npx vercel          # first run: answer the prompts to link/create the project
npx vercel --prod   # production deploy
```

(Or import the Git repo at https://vercel.com/new — same result.)

## 4. Set environment variables

Vercel dashboard → Project → **Settings → Environment Variables**. Add these for
**Production** (and Preview if you want preview deploys to work):

| Name | Value |
|---|---|
| `DATABASE_URL` | the Postgres connection string from step 1 |
| `RESEND_API_KEY` | a **fresh** Resend key (rotate the one shared earlier) — https://resend.com/api-keys |
| `RSVP_EMAIL_FROM` | `A Taste of Home <onboarding@resend.dev>` for now, or `A Taste of Home <rsvp@yourdomain.com>` once a domain is verified |
| `ORGANISER_PASSWORD` | password for the `/organiser` page |
| `SESSION_SECRET` | a long random string |
| `BASE_PATH` | `/` |

`NODE_ENV=production` is set by Vercel automatically.

Then redeploy so the vars take effect: `npx vercel --prod` (or **Redeploy** in the dashboard).

## 5. Test

- `https://<project>.vercel.app/` — guest RSVP flow
- `https://<project>.vercel.app/guest` — public guest list
- `https://<project>.vercel.app/organiser` — organiser view (`ORGANISER_PASSWORD`)
- Submit an RSVP. With `RSVP_EMAIL_FROM` still on `onboarding@resend.dev`, only
  **shayhope1008@gmail.com** (the Resend account owner) actually receives mail;
  everyone else still gets `emailDelivered: false` and the RSVP is kept.

## 6. Real guest emails

Verify a sending domain at https://resend.com/domains (add its SPF + DKIM DNS
records, wait for **Verified**), then change `RSVP_EMAIL_FROM` to an address on
that domain and redeploy.

## Notes

- **`BASE_PATH` must be `/`** in the Vercel build environment — the Vite build
  reads it and errors if unset. `vercel.json`'s `buildCommand` also passes it,
  so setting the env var is belt-and-braces.
- The API is bundled by `pnpm --filter @workspace/api-server run build` into
  `artifacts/api-server/dist/app.mjs` during the Vercel build; `api/index.mjs`
  re-exports it. `dist/` is gitignored and rebuilt on every deploy.
- Local dev is unchanged: run the API (`artifacts/api-server`) on `:5000` and the
  Vite dev server; `vite.config.ts` proxies `/api` to `localhost:5000`
  (override with `API_PROXY_TARGET`). Copy `.env.example` to `.env` first.
- If POST requests arrive with an empty body on Vercel, that's the known
  `@vercel/node` body-parsing quirk — tell me and I'll add the one-line fix.
