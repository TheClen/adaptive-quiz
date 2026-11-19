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
| M3 | Visitor IP reaches the API through the rewrite | T28 | Not run |
| M4 | Spend-limit behaviour on a test workspace | T28 | Not run |
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

Recorded in T28.

## M4 — Spend-limit behaviour on a test workspace

Recorded in T28.

## M5 — Screen reader and keyboard pass

Recorded in T29.
