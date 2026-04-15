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

## Deployment — Railway

Both services deploy to Railway. Railway's GitHub integration handles deploys automatically, including per-PR preview environments — CI does not deploy.

### One-time setup
1. https://railway.app → **New Project → Deploy from GitHub repo** → pick `AscentPlatform/tabletop-companion`.
2. Railway will offer to create services. Create **two** services in the same project, both from this repo:
   - **`frontend`** — Root Directory: `frontend/`. Config is read from `frontend/railway.json` (Nixpacks, serves `dist/` as static).
   - **`api`** — Root Directory: `api/`. Config is read from `api/railway.json` (Nixpacks, `node dist/index.js`, health check on `/health`).
3. On the **api** service → Variables: set `SUPABASE_URL` and `SUPABASE_ANON_KEY` (see `SECRETS.md`). Click **Generate Domain** so the service has a public URL.
4. On the **frontend** service → **Generate Domain** too.
5. **The one manual wiring step** (see next section).

### Manual step: point the frontend at the API
`VITE_API_URL` is consumed by Vite at *build* time, so it must be present in the frontend service's environment before the build runs. In the Railway dashboard:

- **frontend** service → Variables → add:
  ```
  VITE_API_URL=https://${{ api.RAILWAY_PUBLIC_DOMAIN }}
  ```
  The `${{ api.RAILWAY_PUBLIC_DOMAIN }}` reference is resolved by Railway and always points at the current api service's public URL — no manual updates when the domain changes.

### Preview environments
Preview environments are automatic. Enable **PR Environments** at the project level (Settings → Environments → PR Environments → Enabled). From then on, every pull request gets its own isolated copy of both services with their own URLs. The GitHub Actions workflow (`.github/workflows/preview.yml`) waits for those deployments, runs Playwright against the preview frontend URL, and posts a PR comment with links.

## Secrets
See [`SECRETS.md`](./SECRETS.md).

## API contract
`shared/src/schemas.ts` defines zod schemas used by both the api (server-side `.parse()` before responding) and the frontend (runtime validation on fetch + TS types via `z.infer<>`). Change the contract in one file; both sides get compile-time and runtime enforcement.
