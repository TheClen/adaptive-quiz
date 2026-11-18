import { z } from "zod";

/**
 * One option of a choice draft. The model writes the rationale before deciding
 * whether the option is correct, so it justifies every option (plan §8.3). The
 * rationale is not shown to the visitor.
 */
export const ChoiceOptionDraft = z.object({
  text: z.string().min(1),
  rationale: z.string().min(1),
  correct: z.boolean(),
});
export type ChoiceOptionDraft = z.infer<typeof ChoiceOptionDraft>;

/**
 * What the model returns for a single- or multiple-choice question, before the
 * server checks and normalises it (plan §8.4).
 *
 * The schema checks structure only. Option counts, correct counts and field lengths
 * are domain rules, checked by `checkChoiceDraft`, so a broken draft is rejected
 * with a reason the retry message can name. Option ids are assigned by the server
 * after the shuffle, so the draft has none.
 */
export const ChoiceDraft = z.object({
  prompt: z.string().min(1),
  snippet: z
    .object({
      language: z.enum(["javascript", "jsx"]),
      source: z.string().min(1),
    })
    .nullable(),
  options: z.array(ChoiceOptionDraft),
  explanation: z.string().min(1),
});
export type ChoiceDraft = z.infer<typeof ChoiceDraft>;

/**
 * One test of a code exercise draft. Arguments and expected value are JSON text,
 * because structured outputs do not support a recursive schema such as an arbitrary
 * JSON value (plan §9.1). The server parses them.
 */
export const CodeTestDraft = z.object({
  description: z.string().min(1),
  argsJson: z.string().min(1),
  expectedJson: z.string().min(1),
  checksImmutability: z.boolean(),
});
export type CodeTestDraft = z.infer<typeof CodeTestDraft>;

/**
 * What the model returns for a code exercise, before the server checks it, runs it
 * and signs it (plan §8.4, §9.1).
 *
 * As for choice drafts, the schema checks structure only. The function name, the
 * test count, field lengths, forbidden constructs and the test JSON are checked by
 * `checkCodeDraft`, so the retry message can name the broken rule. Test ids are
 * assigned by the server.
 */
export const CodeExerciseDraft = z.object({
  prompt: z.string().min(1),
  functionName: z.string().min(1),
  starterCode: z.string().min(1),
  referenceSolution: z.string().min(1),
  tests: z.array(CodeTestDraft),
  explanation: z.string().min(1),
});
export type CodeExerciseDraft = z.infer<typeof CodeExerciseDraft>;
