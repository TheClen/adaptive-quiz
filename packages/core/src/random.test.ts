import { describe, expect, it } from "vitest";

import { mulberry32 } from "./random.js";

const take = (next: () => number, count: number) => Array.from({ length: count }, () => next());

describe("mulberry32", () => {
  it("matches the reference implementation", () => {
    expect(take(mulberry32(0), 3)).toEqual([
      0.26642920868471265, 0.0003297457005828619, 0.2232720274478197,
    ]);
    expect(take(mulberry32(1), 3)).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522,
    ]);
    expect(take(mulberry32(123_456_789), 3)).toEqual([
      0.2577907438389957, 0.9707721115555614, 0.7853280142880976,
    ]);
  });

  it("gives the same sequence for the same seed", () => {
    expect(take(mulberry32(42), 20)).toEqual(take(mulberry32(42), 20));
  });

  it("gives different sequences for different seeds", () => {
    expect(take(mulberry32(42), 5)).not.toEqual(take(mulberry32(43), 5));
  });

  it("reduces the seed to an unsigned 32-bit integer", () => {
    expect(take(mulberry32(0xffff_ffff + 1), 5)).toEqual(take(mulberry32(0), 5));
    expect(take(mulberry32(0xffff_ffff + 8), 5)).toEqual(take(mulberry32(7), 5));
  });

  it("returns numbers in [0, 1)", () => {
    for (const value of take(mulberry32(7), 10_000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
