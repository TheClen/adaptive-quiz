# ADR 0003 — Monorepo with pnpm workspaces and Turborepo

- Status: Accepted, amended 2026-11-20
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
- **Turborepo.** It orders tasks by dependency, runs them in parallel and caches their results, all from a single `turbo.json`, with no constraints on the code. `turbo query affected` tells which packages a commit affects.
- **Nx.** It is more powerful, but heavier and more opinionated than this project needs.

## Consequences

- Each app is its own Vercel project, with its Root Directory set to its folder under `apps/`. Vercel skips the build of a project that a commit does not affect. If that does not work, the Ignored Build Step falls back to `turbo query affected` (plan 001 §14).
- CI runs `turbo lint typecheck test`. The cache keeps CI fast as the repository grows.
- In production, front-ends reach the API through Vercel rewrites (`/api/*` to the API project). Browsers see a single origin, so no CORS configuration is needed.

## Amendments

### 2026-11-20 — Skipping unaffected builds without `turbo-ignore`

- **Changed:** the Turborepo point of the Rationale, and the first Consequence.
- **Why:** Turborepo has deprecated `turbo-ignore`, which no longer receives updates, in favour of `turbo query affected`. Vercel also skips the build of a monorepo project that a commit does not affect, for GitHub repositories using pnpm workspaces, so no Ignored Build Step is needed. The "pnpm alone" point of the Rationale is therefore weaker than when it was written: Vercel no longer needs Turborepo to know which apps a commit affects. The decision stands, because Turborepo's task ordering and caching still justify it.
- **Replaced text:**
  - Rationale, Turborepo: "`turbo-ignore` lets each Vercel project skip builds that a commit does not affect."
  - Consequences: "Each app is its own Vercel project, with its Root Directory set to its folder under `apps/` and `npx turbo-ignore` as the Ignored Build Step."
