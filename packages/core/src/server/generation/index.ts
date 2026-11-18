/** Question generation and its validation pipeline (plan §8.4, §9). */
export { type ChoiceKind, checkChoiceDraft } from "./choice-rules.js";
export { checkCodeDraft, checkCodeRuns, type CodeDraftCheck, testId } from "./code-rules.js";
export { findForbiddenConstruct, maskLiterals } from "./code-source.js";
export { ChoiceDraft, ChoiceOptionDraft, CodeExerciseDraft, CodeTestDraft } from "./drafts.js";
export {
  type GenerationAttempt,
  type GenerationContext,
  type GenerationResult,
  generateQuestion,
  MAX_GENERATION_ATTEMPTS,
} from "./generate.js";
export { shuffleRandom, toChoiceQuestion } from "./normalise.js";
export { findNearDuplicate, NEAR_DUPLICATE_THRESHOLD, stemSimilarity } from "./similarity.js";
