# Architecture Decision Records

An Architecture Decision Record (ADR) captures one significant decision: the context it was made in, the options considered, the choice, and its consequences. ADRs are never rewritten after acceptance. When a decision changes, a new ADR supersedes the old one, so the history of reasoning stays readable.

## Index

| #    | Decision                                                              | Status   |
| ---- | --------------------------------------------------------------------- | -------- |
| 0001 | [TypeScript on Node.js for the backend, instead of .NET](0001-typescript-node-over-dotnet.md) | Accepted |
| 0002 | [Serverless deployment on Vercel, with a portable Hono API](0002-serverless-on-vercel.md)     | Accepted |
| 0003 | [Monorepo with pnpm workspaces and Turborepo](0003-monorepo-pnpm-turborepo.md)                 | Accepted |
| 0004 | [The API is not an open proxy to the Anthropic API](0004-api-is-not-an-open-proxy.md)          | Accepted |
| 0005 | [Run exercise code in QuickJS (WebAssembly)](0005-quickjs-sandbox-for-exercises.md)            | Accepted |

## Adding an ADR

1. Copy the template below into `NNNN-short-title.md`, using the next number.
2. Open a pull request with status `Proposed`.
3. Set the status to `Accepted` when the pull request is merged.
4. If it replaces an earlier ADR, set the old one to `Superseded by NNNN`. That is the only edit allowed on an accepted ADR.

## Template

```markdown
# ADR NNNN — Title

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD

## Context

What situation forces a decision? What constraints apply?

## Decision drivers

- What matters most when comparing options

## Considered options

1. Option A
2. Option B

## Decision

The option chosen, stated plainly.

## Rationale

Why this option over the others.

## Consequences

What becomes easier, what becomes harder, what we must now do.

## Revisit when

Signals that this decision should be reconsidered (optional).
```
