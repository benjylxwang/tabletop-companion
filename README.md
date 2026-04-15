# tabletop-companion

Monorepo: React+Vite frontend, Express+TS api, shared zod schemas, Playwright e2e.

## Packages
- `frontend/` — React 18 + Vite + Tailwind + React Router + TanStack Query
- `api/` — Express + zod + @supabase/supabase-js
- `shared/` — zod schemas used as the **single source of truth** for API responses. Both `api/` and `frontend/` import from `@tabletop/shared`.
- `e2e/` — Playwright tests, run against `PLAYWRIGHT_BASE_URL`

## Local dev
```bash
pnpm install
cp frontend/.env.example frontend/.env       # already created
cp api/.env.example api/.env                 # optional, empty values fine
pnpm dev                                     # api on :3000, web on :5173
```

## Run Playwright locally
```bash
pnpm --filter e2e exec playwright install --with-deps chromium
# with `pnpm dev` running in another terminal:
PLAYWRIGHT_BASE_URL=http://localhost:5173 pnpm test:e2e
```

## Deploy pipeline
- **Vercel** (frontend) auto-deploys from GitHub; preview URL per PR.
- **Render** (api) auto-deploys from GitHub; preview env per PR.
- **GitHub Actions** (`.github/workflows/preview.yml`) resolves the Vercel preview URL, runs Playwright against it, uploads the report, and posts a sticky PR comment.

## Required GitHub secrets
- `VERCEL_TOKEN`
- `VERCEL_TEAM_ID` (leave blank if personal account)
- `VERCEL_PROJECT_ID`
