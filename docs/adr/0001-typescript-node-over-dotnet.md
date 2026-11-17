# ADR 0001 — TypeScript on Node.js for the backend, instead of .NET

- Status: Accepted
- Date: 2026-11-03

## Context

This project revisits a prototype built in a previous job: an adaptive quiz driven by an LLM, with a small .NET proxy keeping the API key off the client. This version uses the Anthropic API.

The author is a JavaScript/TypeScript developer, front-end by background and now full stack. The project is a portfolio piece meant to demonstrate full-stack skills.

## Decision drivers

- One language across the stack, so types and tooling are shared between front-end and back-end
- Deployment on free, low-maintenance platforms (see [ADR 0002](0002-serverless-on-vercel.md))
- Quality of the official Anthropic SDK
- Consistency with the author's main expertise: TypeScript, full stack

## Considered options

1. ASP.NET Core minimal API, as in the original prototype
2. TypeScript on Node.js

## Decision

Option 2. The backend is written in TypeScript and runs on Node.js, or on any runtime supported by the framework chosen in [ADR 0002](0002-serverless-on-vercel.md).

## Rationale

- **Shared contracts.** Request and response types live in one package used by both the API and the front-ends. Changing a contract fails the type check everywhere it matters.
- **Deployment.** The free serverless platforms with the smoothest developer experience (Vercel, Netlify, Cloudflare) are built around JavaScript runtimes. .NET deploys well too, but usually as a container or on Azure, which adds setup with no benefit here.
- **SDK.** The official `@anthropic-ai/sdk` package is first-class in TypeScript.
- **Maintenance.** The project is maintained by one person whose main expertise is TypeScript. A .NET backend would add a second language and toolchain with no benefit for the product.

## Consequences

- One toolchain across the repository (pnpm, TypeScript, ESLint, Vitest) and no duplicated models.
- The project does not showcase C#/.NET skills. This is accepted.
- The backend must stay compatible with serverless runtimes: no reliance on long-lived process state.
