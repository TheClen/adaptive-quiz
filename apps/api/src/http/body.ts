import type { Context } from "hono";
import type { z } from "zod";

import { ApiFailure } from "./errors.js";

/**
 * Reads the JSON body and parses it with its `shared-types` schema (plan §7).
 * Malformed JSON and a body that fails the schema are both `invalid_request`;
 * neither the body nor the Zod issues reach the response.
 */
export async function parseJsonBody<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiFailure("invalid_request");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiFailure("invalid_request");
  }
  return result.data;
}
