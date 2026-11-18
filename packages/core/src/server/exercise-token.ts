import type { CodeExercise, Json } from "@ai-in-learning/shared-types";

/** A code exercise as generated, before the server signs it. */
export type UnsignedExercise = Omit<CodeExercise, "exerciseToken">;

/** An HMAC-SHA-256 tag is 32 bytes, written as 64 lowercase hex digits. */
const TOKEN_PATTERN = /^[0-9a-f]{64}$/u;

const encoder = new TextEncoder();

/**
 * The canonical JSON of a value: object keys sorted, no whitespace. Two values with
 * the same content give the same text, whatever their key order, so an exercise
 * still verifies after a round trip through the client.
 */
export function canonicalJson(value: Json): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function importKey(secret: string) {
  if (secret === "") {
    throw new Error("The exercise signing secret must not be empty");
  }
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/**
 * The signed bytes: the canonical JSON of every field but the token. The fields are
 * copied one by one, so a property the schema does not know is never signed, and a
 * field added to `CodeExercise` fails to compile here until it is signed too.
 */
function signedBytes(exercise: UnsignedExercise) {
  const signed: UnsignedExercise = {
    kind: exercise.kind,
    prompt: exercise.prompt,
    functionName: exercise.functionName,
    starterCode: exercise.starterCode,
    tests: exercise.tests.map((test) => ({
      id: test.id,
      description: test.description,
      args: test.args,
      expected: test.expected,
      checksImmutability: test.checksImmutability,
    })),
    referenceSolution: exercise.referenceSolution,
    explanation: exercise.explanation,
  };
  return encoder.encode(canonicalJson(signed));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Signs a generated exercise (plan §7.2): `exerciseToken` is the HMAC-SHA-256, keyed
 * with `QUIZ_SIGNING_SECRET`, of the exercise's canonical JSON, in hex. The review
 * endpoint accepts only an exercise whose token verifies, so the only free text a
 * client can send there is its own code (ADR 0004).
 *
 * Uses Web Crypto only, so it runs on Node and in any Web-standard runtime.
 */
export async function signExercise(
  secret: string,
  exercise: UnsignedExercise,
): Promise<CodeExercise> {
  const key = await importKey(secret);
  const tag = await crypto.subtle.sign("HMAC", key, signedBytes(exercise));
  return { ...exercise, exerciseToken: toHex(new Uint8Array(tag)) };
}

/**
 * Whether `exercise.exerciseToken` is the server's signature of the other fields.
 * Any change to the exercise, or a token signed with another secret, gives `false`.
 * The comparison is the constant-time one of `crypto.subtle.verify`.
 */
export async function verifyExercise(secret: string, exercise: CodeExercise): Promise<boolean> {
  const key = await importKey(secret);
  if (!TOKEN_PATTERN.test(exercise.exerciseToken)) {
    return false;
  }
  return crypto.subtle.verify("HMAC", key, fromHex(exercise.exerciseToken), signedBytes(exercise));
}
