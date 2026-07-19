/**
 * Shared API primitives.
 *
 * Every Route Handler returns an {@link ApiResponse} envelope so that clients
 * can discriminate success from failure on the shape of the payload alone.
 */

/** Success envelope: the requested resource lives under `data`. */
export interface ApiSuccess<T> {
  data: T;
}

/** Error envelope: a machine-readable `code` plus a human-readable `message`. */
export interface ApiError {
  error: {
    message: string;
    /** Stable, screaming-snake identifier, e.g. `NOT_FOUND`, `INVALID_BODY`. */
    code: string;
  };
}

/** Discriminated union covering both outcomes of an API call. */
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/**
 * Monetary amount in Iranian Toman, stored as an integer to avoid
 * floating-point rounding errors. `0` denotes a free ticket.
 */
export type Money = number;

/** ISO 8601 date-time string, e.g. `2026-07-19T18:30:00.000Z`. */
export type IsoDateTime = string;
