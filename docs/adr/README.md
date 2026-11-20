# Architecture Decision Records

An Architecture Decision Record (ADR) captures one significant decision: the context it was made in, the options considered, the choice, and its consequences. When a decision changes, a new ADR supersedes the old one, so the history of reasoning stays readable. An accepted ADR is amended in place only when it is really necessary (see [Changing an accepted ADR](#changing-an-accepted-adr)).

## Index

| #    | Decision                                                              | Status   |
| ---- | --------------------------------------------------------------------- | -------- |
| 0001 | [TypeScript on Node.js for the backend, instead of .NET](0001-typescript-node-over-dotnet.md) | Accepted |
| 0002 | [Serverless deployment on Vercel, with a portable Hono API](0002-serverless-on-vercel.md)     | Accepted |
| 0003 | [Monorepo with pnpm workspaces and Turborepo](0003-monorepo-pnpm-turborepo.md)                 | Accepted, amended 2026-11-20 |
| 0004 | [The API is not an open proxy to the Anthropic API](0004-api-is-not-an-open-proxy.md)          | Accepted |
| 0005 | [Run exercise code in QuickJS (WebAssembly)](0005-quickjs-sandbox-for-exercises.md)            | Accepted |

## Adding an ADR

1. Copy the template below into `NNNN-short-title.md`, using the next number.
2. Open a pull request with status `Proposed`.
3. Set the status to `Accepted` when the pull request is merged.
4. If it replaces an earlier ADR, set the old one to `Superseded by NNNN`.

## Changing an accepted ADR

- **The decision changes** (another option is chosen, or the context it rests on no longer holds): write a new ADR that supersedes the old one. On the old ADR, change the status to `Superseded by NNNN` and nothing else.
- **The decision stands, but a detail is wrong or outdated** (a deprecated tool, a changed platform behaviour, a factual error): amend the ADR in place, only when leaving it as written would mislead someone acting on it.
  1. Edit the affected text, and nothing else.
  2. Add `amended YYYY-MM-DD` to the status line.
  3. Add an entry under `## Amendments` at the end of the ADR: the date, what changed and why, and the text it replaced.
  4. Open a pull request. The owner approves it before it is merged.
- **Typos, formatting and broken links** are fixed directly, with no amendment entry.
- When in doubt, supersede.

## Template

```markdown
# ADR NNNN — Title

- Status: Proposed | Accepted | Accepted, amended YYYY-MM-DD | Superseded by NNNN
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

## Amendments

### YYYY-MM-DD — What changed (only once the ADR is amended)

- **Changed:** the sections edited.
- **Why:** the reason the detail no longer holds, and why the decision still does.
- **Replaced text:** the text as it was before.
```
