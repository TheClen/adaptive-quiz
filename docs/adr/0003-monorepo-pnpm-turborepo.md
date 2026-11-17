# ADR 0003 — Monorepo with pnpm workspaces and Turborepo

- Status: Accepted
- Date: 2026-11-03

## Context

The platform will host several front-end apps sharing one API: first the adaptive quiz, later an e-learning module generator, possibly others. The apps share types and the logic that talks to the Anthropic API. A single developer maintains everything.

## Decision drivers

- Shared types and logic without publishing packages
- One place for CI, linting and conventions
- Deploy only the apps affected by a change
- Low tooling overhead for a single developer

## Considered options

1. One repository per app (polyrepo)
2. Monorepo with pnpm workspaces only
3. Monorepo with pnpm workspaces and Turborepo
4. Monorepo with Nx

## Decision

Option 3, with this layout:

```
apps/
  api/            Hono API: every endpoint and every secret
  quiz/           adaptive quiz front-end (Vite + React)
packages/
  core/           framework-agnostic logic: Anthropic client, prompts, rate limiting
  shared-types/   contracts shared by the API and the front-ends
```

New front-ends are added under `apps/`. Packages are scoped as `@ai-in-learning/*`.

## Rationale

- **Polyrepo.** Shared types would have to be published and versioned, which is too heavy for one developer.
- **pnpm alone.** pnpm links local packages, but it has no task caching, and nothing tells Vercel which apps a commit affects.
- **Turborepo.** It orders tasks by dependency, runs them in parallel and caches their results, all from a single `turbo.json`, with no constraints on the code. `turbo-ignore` lets each Vercel project skip builds that a commit does not affect.
- **Nx.** It is more powerful, but heavier and more opinionated than this project needs.

## Consequences

- Each app is its own Vercel project, with its Root Directory set to its folder under `apps/` and `npx turbo-ignore` as the Ignored Build Step.
- CI runs `turbo lint typecheck test`. The cache keeps CI fast as the repository grows.
- In production, front-ends reach the API through Vercel rewrites (`/api/*` to the API project). Browsers see a single origin, so no CORS configuration is needed.
