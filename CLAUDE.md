# CLAUDE.md

An adaptive JavaScript and React quiz built as a pnpm and Turborepo monorepo. Work follows a spec, a plan and a task list. This file holds the working conventions that are not written down anywhere else.

## Read before working

- [specs/constitution.md](specs/constitution.md): the principles every change must follow.
- [specs/001-adaptive-quiz-mvp/tasks.md](specs/001-adaptive-quiz-mvp/tasks.md): the task list. Start from your task's section, then read only the plan and spec sections it cites ([plan.md](specs/001-adaptive-quiz-mvp/plan.md), [spec.md](specs/001-adaptive-quiz-mvp/spec.md)).
- [docs/adr/](docs/adr/): the architecture decisions.
- If a task shows that the plan or the spec is wrong, stop. Propose the amendment and wait for the owner's approval before continuing (principle I). Never edit an approved document silently.
- Steps marked 👤 are owner actions (accounts, keys, approvals). Leave them to the owner.

## Environment

- Use Node 24, pinned in `.nvmrc`. pnpm refuses any other version (`engineStrict`), and the default shell may run a newer Node. In a non-interactive shell, run `source ~/.nvm/nvm.sh && nvm use` before any `pnpm` command.
- pnpm 12 comes from `packageManager` in `package.json`.
- Pin dependencies to exact versions: `pnpm add <name>@<version> --save-exact --filter <package>`.

## Commands

- `pnpm turbo lint typecheck test build` runs the full check, the same one as CI. A task is done only when it passes locally and CI is green.
- `pnpm format` runs Prettier. `lint` also runs `prettier --check`, so format before committing.
- `docs/` and `specs/` are excluded from Prettier on purpose: their formatting is part of the review.
- To work on one package, run its scripts with a filter, for example `pnpm --filter @ai-in-learning/shared-types test`.

## Code

- `packages/shared-types` holds the Zod schemas. Each schema and its inferred type share one name (`export const Question = …; export type Question = z.infer<typeof Question>`). Test fixtures live in `src/testing/`, which the build excludes.
- `packages/core` holds the browser-safe logic. The `runner` and `server` entry points arrive with their tasks (plan §4).
- Workspace packages resolve through the `source` export condition, so tests and type checks need no prior build.
- TypeScript is `strict`, with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `verbatimModuleSyntax`. Relative imports end in `.js`. Type-only imports use `import type`.
- ESLint uses `strictTypeChecked` and `stylisticTypeChecked`. Fix the code rather than disabling a rule.
- Tests sit next to the code as `*.test.ts` and run with Vitest. Tests never call the Anthropic API or Upstash (principle VI).
- Code, comments, documents, commits and pull requests are written in English.

## Git and pull requests

- One task, one branch, one pull request (principle VII). Name task branches `001/T<nn>-<short-name>`, for example `001/T05-catalogue`. Give other changes a short descriptive branch, for example `chore/claude-md`.
- `main` is protected and requires the CI check "Lint, type check, test, build". Never push to `main`.
- Commits follow Conventional Commits. For a task, the subject ends with the task id, and the body says what changed and why, then gives the task:

  ```
  feat(core): add the concept catalogue (001/T05)

  <what changed and why>

  Task: T05 (specs/001-adaptive-quiz-mvp/tasks.md)

  Co-Authored-By: <assistant> <noreply@anthropic.com>
  ```

  Work done with an AI assistant carries a `Co-Authored-By` trailer.

- The pull request title is the commit subject. The body links the task, lists the acceptance criteria it covers, describes what changed, points out choices the reviewer should check, and states that the full check passed locally.
- Pull requests are squash-merged and their branch deleted. After a merge, run `git switch main && git pull --ff-only && git fetch --prune`, then delete the local branch.
- Tasks that change `packages/*/package.json` or `pnpm-lock.yaml` conflict when they run in parallel. Merge them one at a time. Update the branch from `main` and run `pnpm install` before each merge.
