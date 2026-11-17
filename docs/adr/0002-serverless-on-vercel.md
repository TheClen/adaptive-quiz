# ADR 0002 — Serverless deployment on Vercel, with a portable Hono API

- Status: Accepted
- Date: 2026-11-03

## Context

The MVP audience is a small number of visitors trying the public demo. There are no user accounts at first. Hosting must cost close to nothing and require no server maintenance. The demo link must respond immediately: a visitor should never wait for a sleeping server to wake up.

Later versions may add user accounts, a database, and more front-end apps sharing the same API (see [ADR 0003](0003-monorepo-pnpm-turborepo.md)).

## Decision drivers

- Near-zero cost at low traffic
- No cold start long enough for a visitor to notice
- Deployment on `git push`, with a preview deployment for each pull request
- Streaming of LLM responses
- Ability to leave the platform without rewriting the API

## Considered options

1. Vercel Functions on the Hobby plan
2. Cloudflare Pages and Workers
3. Container hosts, either always-on or on free tiers that sleep when idle (Render, Railway, Fly.io)
4. Azure App Service

## Decision

Option 1. Front-end apps are deployed to Vercel as static sites, and the API runs as Vercel Functions.

The API is written with [Hono](https://hono.dev), a small web framework that runs unchanged on Vercel, Cloudflare Workers, plain Node.js and in containers.

## Rationale

- **Vercel** has a free tier that covers this traffic, supports monorepos (one project per app), creates preview deployments, and supports streaming. Billing is mostly based on active CPU time, which suits an API that spends most of its time waiting for the model to respond.
- **Cloudflare** is an equally valid choice, with a larger free tier and built-in rate limiting. Vercel was preferred for its developer experience with React front-ends in a monorepo. Because the API uses Hono, switching later stays cheap.
- **Container hosts.** Free tiers put idle services to sleep, and waking up takes tens of seconds, which is exactly what a first-time visitor opening the demo would hit. Always-on instances cost money for idle time.
- **Azure App Service** fits a .NET backend, which [ADR 0001](0001-typescript-node-over-dotnet.md) ruled out.

## Consequences

- Functions are stateless. Anything that must persist (rate-limit counters, quiz progress, later user data) lives in an external store such as Redis or Postgres.
- Function duration is capped. Long generations must be streamed or split into several shorter requests.
- The Hobby plan is for non-commercial use only. A commercial version would need Vercel Pro or another host.
- Business logic lives in framework-agnostic packages. Only a thin adapter is specific to Vercel.

## Revisit when

- Persistent connections are needed (WebSockets, real-time multiplayer)
- Long-running background jobs appear and need a queue or a worker
- Sustained traffic makes an always-on container cheaper than per-request billing
- The project becomes commercial
