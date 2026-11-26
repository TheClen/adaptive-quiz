# Checks 001 — Adaptive quiz (MVP)

- Date: 2026-11-19
- Plan: [plan.md](plan.md), [section 16.3](plan.md#163-documented-manual-checks)
- Tasks: [tasks.md](tasks.md) (M1 in T18, M3 and M4 in T28, M2 and M5 in T29)

This document records the manual checks of plan §16.3. They run before the first public release. Each check gets its date, who ran it, and its result. A check that fails is fixed and run again; both runs stay in the record.

## Summary

| Id | Check | Task | Status |
| --- | --- | --- | --- |
| M1 | Quality gate on generated questions | T18 | Not run |
| M2 | Latency on the deployed demo | T29 | Not run |
| M3 | Visitor IP reaches the API through the rewrite | T28 | Passed (2026-11-26) |
| M4 | Spend-limit behaviour on a test workspace | T28 | Passed (2026-11-26) |
| M5 | Screen reader and keyboard pass | T29 | Not run |

## M1 — Quality gate on generated questions

Covers NFR-5, NFR-6, the manual part of AC-5.3, and the escalation rule of decision D1 ([plan §8.1](plan.md#81-model-choice)).

### How to run

1. 👤 Put the key of the quiz's dedicated Anthropic workspace, which has a spend limit (plan §11.2), in `apps/api/.env` as `ANTHROPIC_API_KEY`.
2. Run `pnpm --filter @ai-in-learning/api sample-questions`. Add `--topic javascript` or `--topic react` to sample one topic only, for example after tuning its prompts.
3. The script plays 3 simulated sessions per topic through the real pipeline (`generateQuestion`, with its validation and automatic retry), so it produces 30 questions per topic: 15 single choice, 9 multiple choice and 6 code exercises, spread over levels 1 to 5, with concept revisits after a miss. It also asks for one review of each code exercise's reference solution, so the measured cost covers a whole session.
4. It writes a review sheet (`m1-<time>.md`) and the raw results (`m1-<time>.json`) to `apps/api/samples/`, which git ignores, and prints token usage and cost per session.

The sessions use fixed seeds and answer patterns, so every run asks for the same concepts, levels and kinds. Runs before and after prompt tuning can be compared question by question.

### Checklist for each question

A question is **defective** when any of these is false:

1. **Correct.** The question, snippet, options, explanation and, for code exercises, the tests are technically correct for current ECMAScript and React 19.
2. **One defensible answer.** A single-choice question has exactly one defensible answer. A multiple-choice question has exactly the marked set of correct options. No option depends on trick wording.
3. **On topic.** The question tests the stated topic and concept.
4. **Level.** The difficulty is close to the stated level of the rubric (1 basic syntax and behaviour, 2 common usage, 3 typical pitfalls, 4 edge cases and interactions, 5 subtle semantics, performance and design trade-offs). Off by one level is not a defect; a level 5 question that tests basic syntax is.
5. **English.** All text is in English (NFR-6).
6. **Variety.** No question is identical or near-identical to an earlier question of its session (AC-5.3). A revisit tests the concept from a different angle.
7. **Code exercises.** The prompt states what the function must do, the tests match the prompt, and the exercise has no React or browser dependency (AC-3.7). Solvability is already proven by the runner (AC-3.6).

The option rationales on the sheet are the model's own justification. The visitor never sees them; use them to judge whether a marked answer is really right.

A position that could not be generated is not a defective question, but more than 2 failed positions in a run is noted in the results: the visitor would see an error.

### Pass condition

At most **2 defective questions per topic**, out of 30. The measured cost per session is recorded, to confirm or correct the estimate of about $0.02 per session (plan §8.1).

If the gate fails, tune the prompts and run it again. If it still fails after tuning, propose a plan amendment that moves the generation route to Claude Sonnet 5.5, with these results as justification, and get it approved before any further task depends on it.

### Results

One row per run and topic.

| Date | Run by | Commit | Model | Topic | Defective (of 30) | Failed positions | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | |

Defective questions (sheet number, checklist item, short reason):

- None recorded yet.

Measured usage and cost (from the script's output):

| Date | Topic | Mean model calls per session | Mean input tokens | Mean output tokens | Mean cost per session | Estimate |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | $0.02 |

Decision: not taken yet.

## M2 — Latency on the deployed demo

Recorded in T29.

## M3 — Visitor IP reaches the API through the rewrite

Covers the per-IP limits of plan §11.1 behind the cross-project rewrite of plan §14 (ADR 0003). The limiter keys are the SHA-256 of the first `x-forwarded-for` value, so each network has its own counters only if the API sees the visitor's IP, not an address of Vercel's.

### How to run

1. Send requests to the production quiz domain, so they go through the rewrite to the API, from two networks with different public IPs. An invalid body (`POST /api/quiz/next-question` with `{}`) is enough: the API hashes the IP before it validates the request, and it calls no model.
2. Read the API's runtime logs (`vercel logs --project ai-in-learning-api --environment production --json`, or the project's Logs tab). Each request logs one JSON line with its `ipHash` (plan §11.4). The Hobby plan keeps runtime logs for less than an hour, so read them right after the requests.
3. On the machine that sent the first requests, compute the SHA-256 of its public IP and compare it with the logged hash. Record only whether the hashes match, never their values: an unsalted hash of an IPv4 address can be reversed.

### Pass condition

The hash logged for a request through the rewrite is the hash of the sender's own public IP, and the two networks get different, non-null hashes, so separate rate-limit counters.

### Results

| Date | Run by | Deployment | Network | Through the rewrite | Logged hash | Result |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-11-20 | Claude Code | API production `dpl_EYW96fZtErvt5z3iSqJdxArx4Qe1` (commit 70ef904) | Home fibre, IPv4 | Yes, and directly for comparison | The hash of this network's public IP, the same directly and through the rewrite | The visitor IP reaches the API |
| 2026-11-26 | Project owner | Same | Phone on the same Wi-Fi | Yes, one question generated | The same as the home network | Not conclusive: same public IP |
| 2026-11-26 | Project owner | Same | Phone on 4G, Wi-Fi off | Yes, two questions generated | Not null, different from the home network | Passed |

Decision: per-IP limits work through the rewrite. The fallback of plan §14 (serving the API from the quiz project's domain, with a new ADR) is not needed.

## M4 — Spend-limit behaviour on a test workspace

Covers AC-8.3 and the spend-limit row of the error mapping ([plan §11.3](plan.md#113-error-mapping-ac-81-to-ac-84)): when the workspace's monthly spend limit is reached, the API returns `budget_exhausted` and the front-end shows the budget message.

### How to run

1. 👤 In the Claude Console, create a test workspace with the smallest monthly spend limit the Console accepts (a whole number of dollars, so $1), and an API key in that workspace. Check on the API keys page that the key's scope is the test workspace.
2. Put that key in `apps/api/.env` as `ANTHROPIC_API_KEY`. Never put it on Vercel: production keeps its own key.
3. Use up the limit with direct Messages API calls outside the quiz, so the API's own rate limits are not consumed. Long answers from a larger model do it in a few calls (about $0.08 per call of 8,000 output tokens on Claude Sonnet 5.5).
4. The limit is not enforced in real time: keep a hard cap on the number of calls, wait a few minutes, then send one tiny call to see whether the workspace is blocked.
5. Run the API and the quiz locally (`pnpm --filter @ai-in-learning/api dev` and `pnpm --filter @ai-in-learning/quiz dev`), start a session, and check the screen and the API's log line.

### Pass condition

The front-end shows the budget message, and the API logs `budget_exhausted` for the upstream error.

### Results

| Date | Run by | Workspace limit | Spent before the block | Upstream error | API outcome | Front-end | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-26 | Claude Code and project owner | $1 per month | About $1.60 (20 calls, estimated from usage at plan §8.1 prices) | 400 `invalid_request_error`, message "You have reached your specified workspace API usage limits. You will regain access on 2026-12-01 at 00:00 UTC." | 503 `budget_exhausted`, `upstreamStatus` 400 | "Demo temporarily unavailable": the monthly AI budget message | Passed |

Findings:

- The error is the one `mapModelError()` already expects: a 400 with no `error_code`, recognised by its message prefix. No code change is needed.
- Enforcement lags. All 20 calls succeeded, although the estimated spend passed $1 after the 13th; the block applied a few minutes later. The real overrun on the production workspace is bounded by the per-IP and global limits of plan §11.1, not by the spend limit alone.

## M5 — Screen reader and keyboard pass

Recorded in T29.
