/**
 * Shared Route Handler plumbing.
 *
 * Every handler returns the same `ApiResponse<T>` envelope, so the parsing,
 * validation and error-to-envelope translation live here rather than being
 * re-inlined in each `route.ts`. A handler's job is to read input and call a
 * `lib/server` function; anything that can fail throws an {@link HttpError} and
 * {@link handler} turns it into the envelope.
 */

import { NextResponse } from "next/server";
import type { z } from "zod";

import type { ApiError, ApiErrorDetail, ApiResponse, ApiSuccess } from "@/types";

/**
 * Stable, screaming-snake error identifiers. Clients switch on these, so
 * treat the set as part of the public API contract.
 */
export type ErrorCode =
  /** Body was not parseable JSON. */
  | "INVALID_JSON"
  /** Body parsed but failed schema validation; carries `details`. */
  | "INVALID_BODY"
  /** Query string failed schema validation; carries `details`. */
  | "INVALID_QUERY"
  | "NOT_FOUND"
  /** A uniqueness constraint rejected the write (e.g. a discount code). */
  | "DUPLICATE"
  | "SMS_FAILED"
  /** No session cookie, or it no longer resolves to a user. */
  | "UNAUTHENTICATED"
  /** Authenticated, but not allowed to touch this resource. */
  | "FORBIDDEN"
  /** Authenticated, but belongs to no workspace — cannot use the dashboard. */
  | "NOT_A_MANAGER"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "SOLD_OUT"
  | "SALES_CLOSED"
  | "PAYMENT_FAILED"
  | "INTERNAL";

/**
 * An error that carries its own HTTP status and envelope code.
 *
 * Throw this from anywhere beneath a {@link handler} — guards, `lib/server`
 * functions, or the handler body — instead of building an error response by
 * hand.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Success envelope. */
export function ok<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ data }, { status });
}

/** Error envelope. Prefer throwing {@link HttpError}; this is the low-level form. */
export function fail(
  status: number,
  code: ErrorCode,
  message: string,
  details?: ApiErrorDetail[],
): NextResponse<ApiError> {
  return NextResponse.json(
    { error: details ? { message, code, details } : { message, code } },
    { status },
  );
}

/** Flatten a Zod failure into the envelope's `details` array. */
function toDetails(error: z.ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

/**
 * Read and validate a JSON body.
 *
 * @throws HttpError 400 `INVALID_JSON` when the body is not JSON, or 400
 * `INVALID_BODY` with field-level `details` when it fails the schema.
 */
export async function readJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      "INVALID_BODY",
      "Request body failed validation.",
      toDetails(parsed.error),
    );
  }
  return parsed.data;
}

/**
 * Read and validate the query string.
 *
 * @throws HttpError 400 `INVALID_QUERY` with field-level `details`.
 */
export function readQuery<S extends z.ZodType>(
  request: Request,
  schema: S,
): z.infer<S> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    throw new HttpError(
      400,
      "INVALID_QUERY",
      "Query string failed validation.",
      toDetails(parsed.error),
    );
  }
  return parsed.data;
}

/**
 * Wrap a Route Handler so thrown {@link HttpError}s become envelopes and
 * anything unexpected becomes a `500 INTERNAL` instead of leaking a stack
 * trace to the client.
 *
 * ```ts
 * export const GET = handler(async () => ok(await listEvents()));
 * ```
 */
export function handler<A extends unknown[], T>(
  fn: (...args: A) => Promise<NextResponse<ApiResponse<T>>>,
): (...args: A) => Promise<NextResponse<ApiResponse<T>>> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof HttpError) {
        return fail(error.status, error.code, error.message, error.details);
      }
      console.error("[api] unhandled error", error);
      return fail(500, "INTERNAL", "خطای غیرمنتظره‌ای رخ داد.");
    }
  };
}

/** Shorthand for the `404` every `:id` handler needs. */
export function notFound(message: string): HttpError {
  return new HttpError(404, "NOT_FOUND", message);
}
