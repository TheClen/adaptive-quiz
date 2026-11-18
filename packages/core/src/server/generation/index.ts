/** Question generation and its validation pipeline (plan §8.4). */
export { type ChoiceKind, checkChoiceDraft } from "./choice-rules.js";
export { ChoiceDraft, ChoiceOptionDraft } from "./drafts.js";
export {
  type GenerationAttempt,
  type GenerationContext,
  type GenerationResult,
  generateQuestion,
  MAX_GENERATION_ATTEMPTS,
} from "./generate.js";
export { shuffleRandom, toChoiceQuestion } from "./normalise.js";
export { findNearDuplicate, NEAR_DUPLICATE_THRESHOLD, stemSimilarity } from "./similarity.js";
