import { type IpHash, ModelError } from "@ai-in-learning/core/server";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";

import type { Env, EnvResult } from "./env.js";
import { ApiFailure, errorResponse, toApiFailure } from "./http/errors.js";
import {
  consoleLogSink,
  forwardedIpHash,
  type LogSink,
  loggedPath,
  type RequestLogFields,
} from "./http/logging.js";
import { quizRoutes } from "./routes/quiz.js";
import { createServices, type Services } from "./services.js";

/** Request bodies above this size are rejected before parsing (plan §7). */
export const BODY_LIMIT_BYTES = 32 * 1024;

export interface AppBindings {
  Variables: {
    services: Services;
    /** `null` when the request has no `x-forwarded-for` header. */
    ipHash: IpHash | null;
    log: RequestLogFields;
  };
}

export type App = Hono<AppBindings>;

export interface AppOptions {
  /** The parsed environment, from `loadEnv()`. */
  readonly env: EnvResult;
  /** Builds the services from a valid environment. Tests pass fakes. */
  readonly createServices?: (env: Env) => Services;
  readonly log?: LogSink;
  /** A monotonic clock in milliseconds, for request durations. */
  readonly now?: () => number;
}

/**
 * The Hono app (plan §4, §7). It has no platform imports: `index.ts` hands it to
 * Vercel and `dev.ts` to a Node server. Called once per cold start.
 */
export function createApp(options: AppOptions): App {
  const { env, log = consoleLogSink, now = () => performance.now() } = options;
  const services = env.ok ? (options.createServices ?? createServices)(env.env) : null;

  const app = new Hono<AppBindings>();

  // One log line per request, written after every other middleware and the error
  // handler have run, so it sees the final status and outcome (plan §11.4).
  app.use(async (c, next) => {
    const start = now();
    const fields: RequestLogFields = {};
    c.set("log", fields);
    const ipHash = await forwardedIpHash(c.req.header("x-forwarded-for"));
    c.set("ipHash", ipHash);

    await next();

    const { outcome, ...rest } = fields;
    log({
      time: new Date().toISOString(),
      method: c.req.method,
      path: loggedPath(c.req.path),
      status: c.res.status,
      outcome: outcome ?? (c.res.ok ? "ok" : "internal"),
      durationMs: Math.round(now() - start),
      ipHash,
      ...rest,
    });
  });

  app.use(
    secureHeaders({
      // JSON only: nothing to load, nothing to frame.
      contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    }),
  );

  // A missing or malformed variable makes every request fail with `internal`,
  // and the log names the variables (plan §14).
  app.use(async (c, next) => {
    if (services === null) {
      if (!env.ok) {
        c.var.log.invalidVariables = env.invalidVariables;
      }
      throw new ApiFailure("internal");
    }
    c.set("services", services);
    await next();
  });

  app.use(
    bodyLimit({
      maxSize: BODY_LIMIT_BYTES,
      onError: () => {
        throw new ApiFailure("invalid_request");
      },
    }),
  );

  app.route("/api/quiz", quizRoutes());

  app.notFound((c) => {
    const failure = new ApiFailure("invalid_request");
    c.var.log.outcome = failure.code;
    return errorResponse(c, failure, 404);
  });

  // Every thrown error becomes a catalogue response. Messages and stacks are never
  // returned, nor logged: only the error's class name (AC-8.4, plan §11.4).
  app.onError((error, c) => {
    const failure = toApiFailure(error);
    const fields = c.var.log;
    fields.outcome = failure.code;
    if (!(error instanceof ApiFailure)) {
      fields.error = error.name;
    }
    if (error instanceof ModelError) {
      fields.upstreamStatus = error.status;
      fields.upstreamRequestId = error.requestId;
    }
    return errorResponse(c, failure);
  });

  return app;
}
