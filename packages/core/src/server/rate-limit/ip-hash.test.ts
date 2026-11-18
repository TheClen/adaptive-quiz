import { describe, expect, it } from "vitest";

import { hashIp } from "./ip-hash.js";

describe("hashIp", () => {
  it("is the SHA-256 of the address in lowercase hex", async () => {
    // printf '203.0.113.7' | shasum -a 256
    await expect(hashIp("203.0.113.7")).resolves.toBe(
      "fec52565aa0cf18f57d7cf5b3ac728503b8992d2d6f7d46da1d1201090902b02",
    );
  });

  it("gives one hash for the spellings of an address that differ in case or spacing", async () => {
    const expected = "5afd19e856d1c18d17d600dfd2b5f534992333985e126c2a951047102c1ed536";
    await expect(hashIp("2001:db8::1")).resolves.toBe(expected);
    await expect(hashIp(" 2001:DB8::1 ")).resolves.toBe(expected);
  });

  it("gives different hashes for different addresses", async () => {
    expect(await hashIp("203.0.113.7")).not.toBe(await hashIp("203.0.113.8"));
  });

  it("rejects an empty address", async () => {
    await expect(hashIp("  ")).rejects.toThrow("Cannot hash an empty IP address");
  });
});
