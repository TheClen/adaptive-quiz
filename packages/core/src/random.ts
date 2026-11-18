/**
 * A seeded pseudo-random number generator (mulberry32), so that the same seed always
 * gives the same sequence on the client and on the server (plan §6.4).
 *
 * Not suitable for cryptography: it only spreads concept choices across sessions.
 *
 * @param seed Any number; it is reduced to an unsigned 32-bit integer, so
 *   `0xffff_ffff + 1` and `0` give the same sequence.
 * @returns A function that returns the next number of the sequence, in `[0, 1)`.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}
