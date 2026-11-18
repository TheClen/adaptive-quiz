/**
 * The SHA-256 of a visitor's IP address, in lowercase hex. Per-IP limits take this
 * type rather than a plain string, so a raw IP cannot become a Redis key by mistake.
 */
export type IpHash = string & { readonly __brand: "IpHash" };

const encoder = new TextEncoder();

/**
 * Hashes a visitor's IP address with SHA-256 (plan §11.1), so Redis and the request
 * log never hold a raw IP. The address is trimmed and lowercased first, so the
 * spellings of one IPv6 address that differ only in case share one counter.
 *
 * Uses Web Crypto only, so it runs on Node and in any Web-standard runtime.
 */
export async function hashIp(ip: string): Promise<IpHash> {
  const normalised = ip.trim().toLowerCase();
  if (normalised === "") {
    throw new Error("Cannot hash an empty IP address");
  }
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(normalised));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"));
  return hex.join("") as IpHash;
}
