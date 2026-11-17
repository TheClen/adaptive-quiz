# ADR 0004 — The API is not an open proxy to the Anthropic API

- Status: Accepted
- Date: 2026-11-03

## Context

The Anthropic API key must never reach the browser, so every model call goes through our API. Keeping the key on the server is not enough, though. An endpoint that forwards arbitrary requests to Anthropic lets anyone spend our credits, for any purpose, simply by calling it directly. The MVP has no authentication, so its endpoints are public by design.

## Decision drivers

- The key is never exposed
- Spending is bounded, whatever happens
- Abuse of one app cannot take down another
- No user accounts in the MVP

## Considered options

1. Generic pass-through proxy: the client sends the model, messages and parameters
2. Domain-specific endpoints where the server owns every model parameter, with layered limits

## Decision

Option 2, with these layers:

1. **Domain-specific endpoints** such as `POST /quiz/next-question`, never a generic `/messages`. The client sends domain data (topic, previous answers, current level), never prompts or model parameters.
2. **The server owns the model call.** The model, system prompt, `max_tokens` and every other parameter are set on the server.
3. **Validated input.** Every request body is validated against a Zod schema and capped in size. Invalid input is rejected before any call to Anthropic.
4. **Per-IP rate limiting** with Upstash Redis, namespaced per app (`quiz:`, `builder:`).
5. **Bounded spending.** A dedicated Anthropic workspace has a monthly spend limit, and each app has its own API key.
6. **Same origin.** In production, front-ends call the API through same-origin rewrites ([ADR 0003](0003-monorepo-pnpm-turborepo.md)). If CORS is enabled, it allows only the project's own domains. CORS is not treated as a security boundary.
7. **Bot protection, only if needed.** Cloudflare Turnstile can be added if abuse is observed.

## Rationale

A pass-through proxy turns a public, unauthenticated endpoint into free general-purpose access to the model. Domain-specific endpoints restrict what can be asked. Rate limiting restricts how often. The spend limit caps the worst case even if every other layer fails.

## Consequences

- Each new feature needs its own endpoint and validation schema. That is more code, but every capability is explicit and reviewable.
- The worst case is bounded by the spend limit. Once it is reached, the demo stops answering until credits are topped up, so the front-end must show a clear message in that case.
- Prompts live in a public repository. This is acceptable: protection relies on server-side limits, not on secrecy of code.
- Error responses never leak upstream details such as the key or raw Anthropic errors.
