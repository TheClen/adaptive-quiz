import { z } from "zod";

/** Field length limits shared by the API and the validation pipeline (plan §8.4). */
export const LIMITS = {
  prompt: 600,
  /** The statement of a code exercise, which describes inputs, output and an example. */
  exercisePrompt: 900,
  optionText: 200,
  explanation: 800,
  code: 2_000,
  testDescription: 200,
  /** Characters of `JSON.stringify({ args, expected })` for one test. */
  testJson: 2_048,
  exerciseToken: 256,
} as const;

/** Any JSON value. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export const Json: z.ZodType<Json> = z.json();

/** Option ids, assigned by the server in display order. */
export const OptionId = z.enum(["a", "b", "c", "d", "e", "f"]);
export type OptionId = z.infer<typeof OptionId>;

export const Option = z.object({
  id: OptionId,
  text: z.string().min(1).max(LIMITS.optionText),
});
export type Option = z.infer<typeof Option>;

/** A read-only code snippet shown with a choice question (AC-2.5). */
export const Snippet = z.object({
  language: z.enum(["javascript", "jsx"]),
  source: z.string().min(1).max(LIMITS.code),
});
export type Snippet = z.infer<typeof Snippet>;

/** One test of a code exercise: data, never code (plan §9.1). */
export const ExerciseTest = z
  .object({
    id: z.string().min(1).max(32),
    description: z.string().min(1).max(LIMITS.testDescription),
    args: z.array(Json),
    expected: Json,
    checksImmutability: z.boolean(),
  })
  .refine(
    (test) =>
      JSON.stringify({ args: test.args, expected: test.expected }).length <= LIMITS.testJson,
    { message: `Test arguments and expected value exceed ${String(LIMITS.testJson)} characters` },
  );
export type ExerciseTest = z.infer<typeof ExerciseTest>;

function hasUniqueIds(items: readonly { id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

const uniqueIdsIssue = { message: "Ids must be unique" } as const;

const choiceFields = {
  prompt: z.string().min(1).max(LIMITS.prompt),
  snippet: Snippet.nullable(),
  explanation: z.string().min(1).max(LIMITS.explanation),
};

/** Single choice: exactly 4 options, exactly one correct (AC-2.1). */
export const SingleChoiceQuestion = z
  .object({
    kind: z.literal("single"),
    ...choiceFields,
    options: z.array(Option).length(4),
    correctOptionId: OptionId,
  })
  .superRefine((question, ctx) => {
    if (!hasUniqueIds(question.options)) {
      ctx.addIssue({ code: "custom", path: ["options"], ...uniqueIdsIssue });
    }
    if (!question.options.some((option) => option.id === question.correctOptionId)) {
      ctx.addIssue({
        code: "custom",
        path: ["correctOptionId"],
        message: "The correct option must be one of the options",
      });
    }
  });
export type SingleChoiceQuestion = z.infer<typeof SingleChoiceQuestion>;

/** Multiple choice: 4 to 6 options, at least 2 correct and at least 1 incorrect (AC-2.2). */
export const MultipleChoiceQuestion = z
  .object({
    kind: z.literal("multiple"),
    ...choiceFields,
    options: z.array(Option).min(4).max(6),
    correctOptionIds: z.array(OptionId).min(2),
  })
  .superRefine((question, ctx) => {
    if (!hasUniqueIds(question.options)) {
      ctx.addIssue({ code: "custom", path: ["options"], ...uniqueIdsIssue });
    }
    const optionIds = new Set(question.options.map((option) => option.id));
    const correctIds = new Set(question.correctOptionIds);
    if (correctIds.size !== question.correctOptionIds.length) {
      ctx.addIssue({ code: "custom", path: ["correctOptionIds"], ...uniqueIdsIssue });
    }
    if (![...correctIds].every((id) => optionIds.has(id))) {
      ctx.addIssue({
        code: "custom",
        path: ["correctOptionIds"],
        message: "Every correct option must be one of the options",
      });
    }
    if (correctIds.size >= optionIds.size) {
      ctx.addIssue({
        code: "custom",
        path: ["correctOptionIds"],
        message: "At least one option must be incorrect",
      });
    }
  });
export type MultipleChoiceQuestion = z.infer<typeof MultipleChoiceQuestion>;

/** A code exercise, signed by the server with `exerciseToken` (plan §7.1, §9.1). */
export const CodeExercise = z
  .object({
    kind: z.literal("code"),
    prompt: z.string().min(1).max(LIMITS.exercisePrompt),
    functionName: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
    starterCode: z.string().min(1).max(LIMITS.code),
    tests: z.array(ExerciseTest).min(3).max(6),
    referenceSolution: z.string().min(1).max(LIMITS.code),
    explanation: z.string().min(1).max(LIMITS.explanation),
    exerciseToken: z.string().min(1).max(LIMITS.exerciseToken),
  })
  .superRefine((exercise, ctx) => {
    if (!hasUniqueIds(exercise.tests)) {
      ctx.addIssue({ code: "custom", path: ["tests"], ...uniqueIdsIssue });
    }
  });
export type CodeExercise = z.infer<typeof CodeExercise>;

/** A question as the client receives it, discriminated by `kind`. */
export const Question = z.discriminatedUnion("kind", [
  SingleChoiceQuestion,
  MultipleChoiceQuestion,
  CodeExercise,
]);
export type Question = z.infer<typeof Question>;
