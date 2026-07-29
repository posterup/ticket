"use client";

import { useCallback, useEffect, useState } from "react";

import type { ApiResponse } from "@/types";

/** An API call that failed, carrying the envelope's code so callers can branch. */
export class ApiCallError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiCallError";
  }
}

/**
 * Call the API and unwrap the envelope.
 *
 * Throws on failure rather than returning a union, so callers that only care
 * about the happy path stay readable and the hook below can funnel every
 * failure into one place.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  let body: ApiResponse<T> | null = null;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    // A non-JSON body means something upstream failed, not the API.
  }

  if (!res.ok || !body || "error" in body) {
    const error = body && "error" in body ? body.error : null;
    throw new ApiCallError(
      res.status,
      error?.code ?? "NETWORK",
      error?.message ?? "ارتباط با سرور برقرار نشد.",
    );
  }
  return body.data;
}

export interface ApiState<T> {
  data: T | null;
  error: ApiCallError | null;
  /** True until the first response, and during an explicit reload. */
  loading: boolean;
  reload: () => void;
}

/**
 * Fetch on mount, and whenever `path` changes.
 *
 * Passing `null` skips the request — for data that depends on something not
 * known yet, which would otherwise need a second hook and a conditional.
 */
export function useApi<T>(path: string | null): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiCallError | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (path === null) {
      setLoading(false);
      return;
    }

    // Guards against a slow first request resolving after a faster second one
    // and overwriting it.
    let live = true;
    setLoading(true);
    setError(null);

    apiFetch<T>(path)
      .then((result) => {
        if (live) setData(result);
      })
      .catch((err: ApiCallError) => {
        if (live) setError(err);
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [path, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, reload };
}
