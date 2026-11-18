/** A draft whose stem scores this much or more against a previous stem is rejected (plan §8.4). */
export const NEAR_DUPLICATE_THRESHOLD = 0.6;

/** The words of a stem: lowercase, with punctuation and whitespace collapsed (plan §8.4). */
function wordsOf(stem: string): string[] {
  return stem
    .normalize("NFKC")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);
}

/**
 * The word trigrams of a stem. A stem of one or two words has a single shingle made
 * of all its words, so two identical short stems still match.
 */
function trigramsOf(stem: string): Set<string> {
  const words = wordsOf(stem);
  if (words.length < 3) {
    return new Set(words.length === 0 ? [] : [words.join(" ")]);
  }
  const trigrams = new Set<string>();
  for (let index = 0; index + 3 <= words.length; index += 1) {
    trigrams.add(words.slice(index, index + 3).join(" "));
  }
  return trigrams;
}

/**
 * The word-trigram Jaccard similarity of two stems, from 0 (no shared trigram) to 1
 * (same trigrams). Two stems without any word score 0.
 */
export function stemSimilarity(a: string, b: string): number {
  const left = trigramsOf(a);
  const right = trigramsOf(b);
  let shared = 0;
  for (const trigram of left) {
    if (right.has(trigram)) {
      shared += 1;
    }
  }
  const union = left.size + right.size - shared;
  return union === 0 ? 0 : shared / union;
}

/**
 * The index of the first previous stem that `stem` nearly duplicates, or `-1` when
 * there is none (AC-5.3).
 */
export function findNearDuplicate(stem: string, previous: readonly string[]): number {
  return previous.findIndex(
    (candidate) => stemSimilarity(stem, candidate) >= NEAR_DUPLICATE_THRESHOLD,
  );
}
