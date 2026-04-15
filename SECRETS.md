# Secrets

Exactly three secrets are needed. They live in different places — don't mix them up.

## GitHub Actions (Settings → Secrets and variables → Actions)

- **`RAILWAY_TOKEN`** — account or team token with read access to the Railway project. Used by `.github/scripts/wait-for-railway.mjs` to poll deployment status and resolve preview URLs. Create at https://railway.app/account/tokens.

## Railway (api service → Variables)

- **`SUPABASE_URL`** — set on the Railway **api** service.
- **`SUPABASE_ANON_KEY`** — set on the Railway **api** service.

These two are consumed by the deployed api process at runtime (read and logged on startup; real use comes tomorrow). They are **not** needed in GitHub Actions — CI never hits Supabase.
