import { hashIp, type IpHash, type ModelUsage } from "@ai-in-learning/core/server";
import type { ErrorCode } from "@ai-in-learning/shared-types";

import type { EnvName } from "../env.js";

/**
 * What a request adds to its log line while it runs. Routes set the model
 * fields; the error handler sets the outcome. Nothing here may hold a secret,
 * a raw IP, visitor code or a prompt (plan §11.4).
 */
export interface RequestLogFields {
  outcome?: ErrorCode;
  /** The class name of an unexpected error. Its message is never logged. */
  error?: string;
  /** From a `ModelError`, for matching with Anthropic's logs. */
  upstreamStatus?: number | null;
  upstreamRequestId?: string | null;
  /** The names of missing or malformed environment variables, never their values. */
  invalidVariables?: readonly EnvName[];
  model?: string;
  attempts?: number;
  usage?: ModelUsage;
}

/** One structured line per request (plan §11.4). */
export interface RequestLogLine extends Omit<RequestLogFields, "outcome"> {
  readonly time: string;
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly outcome: "ok" | ErrorCode;
  readonly durationMs: number;
  readonly ipHash: IpHash | null;
}

export type LogSink = (line: RequestLogLine) => void;

/** Writes the line as JSON on stdout, where Vercel collects function logs. */
export const consoleLogSink: LogSink = (line) => {
  console.log(JSON.stringify(line));
};

/** Long enough for every route; anything longer is cut so a request cannot flood the log. */
const MAX_LOGGED_PATH_LENGTH = 200;

export function loggedPath(path: string): string {
  return path.length > MAX_LOGGED_PATH_LENGTH ? path.slice(0, MAX_LOGGED_PATH_LENGTH) : path;
}

/**
 * The hash of the visitor's IP, from the first value of `x-forwarded-for` (plan
 * §11.1). `null` when the header is missing or empty.
 */
export async function forwardedIpHash(header: string | undefined): Promise<IpHash | null> {
  const ip = header?.split(",")[0]?.trim() ?? "";
  return ip === "" ? null : hashIp(ip);
}
