import { z } from "zod";

/**
 * The API's environment variables (plan §14). They are secrets or point to
 * services, so this module never returns, logs or reports their values.
 */
export const Env = z.object({
  ANTHROPIC_API_KEY: z.string().trim().min(1),
  UPSTASH_REDIS_REST_URL: z.url({ protocol: /^https$/u }),
  UPSTASH_REDIS_REST_TOKEN: z.string().trim().min(1),
  /** The HMAC key for exercise tokens (plan §7.2). 32 characters at least. */
  QUIZ_SIGNING_SECRET: z.string().trim().min(32),
});
export type Env = z.infer<typeof Env>;

export type EnvName = keyof Env;

const ENV_NAMES = Env.keyof().options;

export type EnvResult =
  | { readonly ok: true; readonly env: Env }
  /** The names of the missing or malformed variables, never their values. */
  | { readonly ok: false; readonly invalidVariables: readonly EnvName[] };

/**
 * Parses the environment once per cold start (plan §14). The result holds either
 * every variable, or only the names of the ones that are missing or malformed,
 * so a caller cannot log a value by mistake. Other variables are ignored.
 */
export function loadEnv(source: Readonly<Record<string, string | undefined>>): EnvResult {
  const result = Env.safeParse(Object.fromEntries(ENV_NAMES.map((name) => [name, source[name]])));
  if (result.success) {
    return { ok: true, env: result.data };
  }
  const invalid = new Set(result.error.issues.map((issue) => issue.path[0]));
  return { ok: false, invalidVariables: ENV_NAMES.filter((name) => invalid.has(name)) };
}
