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
 * Send an expired session back to sign-in, once.
 *
 * A dead session used to be *reported* rather than acted on: the page printed
 * «نشست شما منقضی شده است. دوباره وارد شوید.» and left the reader to find the
 * login link themselves. Worse, the one place that did try to redirect
 * (`app/(dashboard)/layout.tsx`) could not succeed, because the cookie is still
 * *present* — it is the session behind it that is gone. `middleware.ts` gates on
 * `cookies.has(SESSION_COOKIE)` and nothing more, by design, since Prisma cannot
 * run on the Edge; so it saw a signed-in visitor, bounced them off `/login`
 * straight back to `/dashboard/events`, and the message reappeared. That bounce
 * is the loop this actually fixes.
 *
 * So the cookie has to go before the navigation. `POST /api/auth/logout` is
 * idempotent and clears it, and only then does middleware agree that this
 * person is signed out and let `/login` render.
 *
 * `location.replace`, not the router: it drops the dead page from history, so
 * Back cannot return to a screen that will only 401 again. The one-shot latch
 * matters because a dashboard screen fires several requests at once and every
 * one of them fails — without it they would race to navigate.
 *
 * Only `UNAUTHENTICATED`. `NOT_A_MANAGER` is a *signed-in* user with no
 * workspace; sending them to `/login` would sign out someone whose credentials
 * are perfectly good, and land them back here on the next attempt.
 */
let signingOut = false;

async function bounceToLogin(): Promise<void> {
  if (signingOut || typeof window === "undefined") return;
  signingOut = true;
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Offline, or the API is down. Navigate anyway — a login page that asks
    // for credentials again beats a dead screen quoting an error code.
  }
  const next = window.location.pathname + window.location.search;
  window.location.replace(`/login?next=${encodeURIComponent(next)}`);
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
    const code = error?.code ?? "NETWORK";
    // Fire and forget: the throw below still happens, so callers keep their
    // error state while the navigation is on its way.
    if (code === "UNAUTHENTICATED") void bounceToLogin();
    throw new ApiCallError(
      res.status,
      code,
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
