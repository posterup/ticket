/**
 * Helpers for exercising Route Handlers directly.
 *
 * The handlers are plain functions over `lib/server`, so they can be called
 * in-process without booting Next. That keeps the API contract — status codes
 * and error envelopes — under test without an HTTP server.
 */

import type { ApiResponse } from "@/types";

const BASE = "http://test.local";

/** A JSON request. Pass a raw string as `body` to exercise malformed JSON. */
export function req(
  method: string,
  path: string,
  body?: unknown,
): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });
}

/** The `{ params }` context Next passes as a handler's second argument. */
export function ctx<T extends Record<string, string>>(
  params: T,
): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}

export interface Parsed<T> {
  status: number;
  body: ApiResponse<T>;
}

/** Await a handler response into `{ status, body }`. */
export async function parse<T>(res: Response): Promise<Parsed<T>> {
  return { status: res.status, body: (await res.json()) as ApiResponse<T> };
}

/** Narrow to the success payload, failing loudly when the call errored. */
export function data<T>(parsed: Parsed<T>): T {
  if ("error" in parsed.body) {
    throw new Error(
      `expected success, got ${parsed.status} ${parsed.body.error.code}: ${parsed.body.error.message}`,
    );
  }
  return parsed.body.data;
}

/** The machine-readable code of an error envelope. */
export function errorCode<T>(parsed: Parsed<T>): string {
  if (!("error" in parsed.body)) throw new Error("expected an error envelope");
  return parsed.body.error.code;
}
