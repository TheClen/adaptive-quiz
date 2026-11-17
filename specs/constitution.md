# Project Constitution

- Version: 1.0.0
- Ratified: 2026-11-03

These principles are non-negotiable. Every spec, plan, task and line of code in this repository must comply with them, whether written by a person or by an AI assistant. When a principle and a request conflict, the principle wins until the constitution is amended.

Architecture decisions that implement these principles are recorded in [`docs/adr/`](../docs/adr/README.md).

## I. Spec before code

Work follows four stages, in order:

1. **Spec** (`spec.md`): what we build and why. User stories, acceptance criteria, out-of-scope items. No technical choices.
2. **Plan** (`plan.md`): how we build it. Architecture, endpoints, data contracts, technical choices.
3. **Tasks** (`tasks.md`): the plan split into small, independently verifiable tasks.
4. **Implementation**: one task at a time.

The project owner reviews and approves each stage before the next one starts. No code is written for behaviour that is not in an approved spec. When implementation reveals that a spec or plan is wrong, the document is updated and approved first, then the code follows.

*Why: specs keep the project owner in control of what an AI assistant builds, and they leave a readable record of every decision.*

## II. Secrets stay on the server

- API keys and other secrets exist only in server-side environment variables, never in front-end code, bundles, URLs or logs.
- Secrets are never committed. `.env` files are ignored by git. A committed `.env.example` lists variable names without values.
- Error responses never expose secrets or raw upstream errors.

*Why: the public repository and the public demo must be safe to share with anyone.*

## III. Bounded cost

- The server owns every model parameter: model, system prompt, `max_tokens`. Clients send domain data only ([ADR 0004](../docs/adr/0004-api-is-not-an-open-proxy.md)).
- Every public endpoint that calls a model is rate limited.
- The Anthropic workspace used in production has a spend limit.
- Each feature uses the smallest model that meets its acceptance criteria. Choosing a larger model must be justified in the plan.

*Why: the demo is public and unauthenticated. The worst case must cost a known, small amount.*

## IV. Strict, shared contracts

- TypeScript runs in `strict` mode everywhere. `any` requires a comment explaining why.
- Types shared between the API and the front-ends live in `packages/shared-types`, never duplicated.
- Data crossing a trust boundary (request bodies, model output, environment variables) is validated at runtime with Zod.

*Why: a contract change must fail the build wherever it matters, and model output must never be trusted blindly.*

## V. Stateless, portable backend

- API handlers keep no data in memory between requests: no global variable holding counters, sessions or caches. Anything that must outlive a request goes to an external store such as Redis or a database, or is sent back by the client with each request.
- Business logic (building prompts, adapting difficulty, evaluating answers) lives in `packages/core`, which depends on neither Hono nor Vercel. The API layer only validates the request, calls `core` and formats the response. The Vercel adapter only connects the Hono app to Vercel.

*Why: serverless functions are stateless, and the platform must remain replaceable ([ADR 0002](../docs/adr/0002-serverless-on-vercel.md)).*

## VI. Tested acceptance criteria

- Every acceptance criterion in a spec maps to at least one automated test, or to a documented manual check when automation is not practical.
- Tests never call the real Anthropic API. Model responses are mocked.
- CI (lint, type check, tests) must pass before a pull request is merged.

*Why: a spec is only useful if we can prove the code meets it.*

## VII. Small, traceable changes

- One task, one branch, one pull request. The pull request links the spec and the task it implements.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org).
- Work done with an AI assistant is disclosed in the commit trailer (`Co-Authored-By`).
- Specs and plans are committed before the code that implements them.

*Why: the git history should tell how the project was built, and show that AI assistance was used openly and under control.*

## VIII. Accessible and resilient interfaces

- Interfaces meet WCAG 2.2 level AA: keyboard navigation, visible focus, sufficient contrast, meaningful labels.
- Loading, empty and error states are designed, including the case where the model is unavailable or the spend limit is reached.

*Why: a first-time visitor must be able to use the demo right away, even when something goes wrong.*

## IX. Simplicity first

- No dependency, service or infrastructure is added unless an approved spec or plan needs it.
- Significant technical decisions are recorded as ADRs before they are implemented.

*Why: every piece of the stack must have a reason to be there, and that reason must be written down.*

## Governance

- The constitution is amended through a pull request that explains the change and its reason.
- Versions follow semantic versioning: major for removing or redefining a principle, minor for adding one, patch for wording.
- Specs and plans state which constitution version they were written against.
