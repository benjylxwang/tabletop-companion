# Secrets

Exactly three secrets are needed. They live in different places — don't mix them up.

## GitHub Actions (Settings → Secrets and variables → Actions)

- **`RAILWAY_TOKEN`** — Railway API token with read access to the project. Create at https://railway.app/account/tokens (or a team/project token). Used by `.github/scripts/wait-for-railway.mjs` to poll deployment status.
- **`RAILWAY_PROJECT_ID`** — the project UUID. Visible in any Railway dashboard URL, e.g. `railway.com/project/<this-uuid>/...`. Required because most Railway tokens can't enumerate projects via the API.
- **`R2_ACCOUNT_ID`**, **`R2_ACCESS_KEY_ID`**, **`R2_SECRET_ACCESS_KEY`**, **`R2_BUCKET`**, **`R2_PUBLIC_URL_BASE`** — Cloudflare R2 credentials + bucket name + the bucket's public `https://pub-<hash>.r2.dev` URL. Used by `.github/scripts/upload-to-r2.mjs` to upload the Playwright HTML report and videos so they can be linked directly from the PR comment (no zip download needed). Scope the R2 API token to a single bucket.

## Railway (api service → Variables)

- **`SUPABASE_URL`** — set on the Railway **api** service.
- **`SUPABASE_ANON_KEY`** — set on the Railway **api** service.

These two are consumed by the deployed api process at runtime (read and logged on startup; real use comes tomorrow). They are **not** needed in GitHub Actions — CI never hits Supabase.
