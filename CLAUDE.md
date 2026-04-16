# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tabletop Companion is a campaign management tool for tabletop RPGs. It focuses on the narrative and organisational layer — notes, session history, world-building, NPCs, and lore — not mechanics like hit points or spell slots. It is system-agnostic (D&D, Pathfinder, Daggerheart, etc.).

Monorepo with four pnpm workspace packages: `api/` (Express), `frontend/` (React + Vite), `shared/` (Zod schemas), and `e2e/` (Playwright).

## Commands

```bash
# Install dependencies
pnpm install

# Run all packages in dev mode (shared builds first, then api:3000 + frontend:5173)
pnpm dev

# Build all packages
pnpm build

# Run E2E tests (requires frontend running or PLAYWRIGHT_BASE_URL set)
PLAYWRIGHT_BASE_URL=http://localhost:5173 pnpm test:e2e

# Install Playwright browsers (needed before first E2E run)
pnpm --filter e2e exec playwright install --with-deps chromium

# Run a single E2E test
pnpm --filter e2e exec playwright test tests/homepage.spec.ts

# Build a single package
pnpm --filter api build
pnpm --filter frontend build
pnpm --filter @tabletop/shared build
```

No unit test framework is set up yet. Lint scripts exist but are stubs.

## Architecture

**Shared schemas are the single source of truth for API contracts.** `shared/src/schemas.ts` defines Zod schemas (e.g., `HealthResponse`, `Campaign`, `CampaignsResponse`) that both the API and frontend import. The API validates responses with `.parse()` and the frontend validates fetched data the same way. Always define new API shapes here first.

**Package dependency flow:** `frontend/` and `api/` both depend on `@tabletop/shared`. The shared package must be built before the others can use its types (`pnpm dev` handles this via a `predev` script).

**API (`api/`):** Express server with TypeScript (NodeNext modules). Routes live in `api/src/routes/`. CORS is configured to allow localhost and Railway domains. Supabase client is initialized in `api/src/index.ts`.

**Frontend (`frontend/`):** React 18 + Vite + React Router + TanStack Query. Entry point is `frontend/src/main.tsx`. Routes are in `frontend/src/routes/`. API calls go through `frontend/src/lib/api.ts`. Uses Tailwind CSS for styling. `VITE_API_URL` is consumed at build time.

**E2E (`e2e/`):** Playwright tests in `e2e/tests/`. Runs against Chromium only. Uses `PLAYWRIGHT_BASE_URL` env var for the target URL.

## Domain Model & Conventions

**Core entities:** Campaign > Sessions, Characters (PCs), NPCs, Locations, Factions, Lore entries. A Campaign is the top-level container; everything else belongs to one.

**Permission model (the defining feature):** Every piece of content has a visibility: Private (DM only), Public (DM + all players), or Revealed (DM + specific players). The golden rule: **no DM-private content ever appears in a player-facing API response**. Filter at the query level, not the presentation level.

**Private field convention:** All DM-only fields are prefixed `dm_` in the database schema (e.g., `dm_notes`). Any field prefixed `dm_` is stripped from non-DM responses.

**DM View Toggle:** The DM can switch between "View as DM" (all content) and "View as Player" (public only). The toggle passes `view=player` to API queries, which filter responses server-side. Never filter DM content client-side only.

**API response shapes:** All responses are wrapped objects (e.g., `{ sessions: [] }`, `{ npc: {} }`).

**Rich text:** Plain text strings in v1. Rich text editing (Markdown/WYSIWYG) is a stretch goal.

**Character sheets:** Stored as uploaded files (PDF or image), not parsed or interacted with mechanically.

**AI Session Summary:** DM can generate narrative recaps of sessions via Claude. Respects current view mode — in Player View, `dm_` fields are stripped before sending to Claude.

## Workflow

Follow this workflow for every feature or change:

1. **Plan first.** Enter plan mode and get approval before writing code. Explore the codebase, identify affected files, and design the approach.
2. **Strict types.** Never use `any` or `unknown` types. Define proper types for all data — use Zod schemas in `shared/` and infer TypeScript types from them.
3. **Unit tests.** Write unit tests for all new code. Ensure all tests pass before proceeding. Aim for 80% coverage.
4. **E2E tests.** Add Playwright tests for every feature in `e2e/tests/`. Verify they pass locally.
5. **Type check.** Run `pnpm build` to verify there are no type errors across all packages.
6. **One feature, one PR.** Each feature gets its own branch and PR. Do not bundle unrelated changes.
7. **Push and verify CI.** Push the branch, create the PR, then monitor the GitHub Actions CI. Run Playwright tests against the preview deployment.
8. **Notify for review.** Once CI passes and all checks are green, notify that the PR is ready for human review.

## TypeScript

All packages extend `tsconfig.base.json` (ES2022, strict, ESNext modules, bundler resolution). The API uses NodeNext module resolution. The frontend uses `noEmit` (Vite handles bundling).

## Deployment

Two Railway services: API (Node process with `/health` check) and frontend (static `dist/` served via `serve`). GitHub Actions CI runs type-check, waits for Railway preview deployments, then runs Playwright E2E tests against the preview URL. Reports and videos are uploaded to Cloudflare R2.

## Environment Variables

- `frontend/.env`: `VITE_API_URL=http://localhost:3000`
- `api/.env`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PORT` (default 3000)
- Copy from `.env.example` files in each package.
