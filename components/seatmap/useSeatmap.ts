"use client";

/**
 * Seat-map data plumbing.
 *
 * Two caches with very different lifetimes, matching the two kinds of payload:
 *
 *  * **Geometry** is immutable per layout version, so it is memoised in a
 *    module-level map that outlives the component. Re-opening a section the
 *    customer already looked at costs nothing — no request, no re-parse.
 *  * **Availability** is volatile and is polled, never cached.
 *
 * The geometry cache is bounded. Keeping every section a customer has opened
 * would hold a stadium's worth of arrays alive on a phone; three is enough for
 * the back-and-forth people actually do when comparing sections, which is the
 * thrash the progressive design exists to avoid.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch, type ApiCallError } from "@/lib/client/api";
import type {
  SectionSeats,
  SectionStatus,
  SessionAvailabilitySnapshot,
  VenueOverview,
} from "@/types";

const MAX_CACHED_SECTIONS = 3;

const overviewCache = new Map<string, Promise<VenueOverview>>();
const seatCache = new Map<string, Promise<SectionSeats>>();

function cacheSeats(key: string, value: Promise<SectionSeats>): void {
  seatCache.set(key, value);
  // Map preserves insertion order, so the first key is the least recently
  // added. Re-reads refresh their position in `loadSection`.
  while (seatCache.size > MAX_CACHED_SECTIONS) {
    const oldest = seatCache.keys().next().value;
    if (oldest === undefined) break;
    seatCache.delete(oldest);
  }
}

export function loadOverview(versionId: string): Promise<VenueOverview> {
  const hit = overviewCache.get(versionId);
  if (hit) return hit;
  const promise = apiFetch<VenueOverview>(
    `/api/layouts/${versionId}/overview`,
  ).catch((error) => {
    overviewCache.delete(versionId);
    throw error;
  });
  overviewCache.set(versionId, promise);
  return promise;
}

export function loadSection(
  versionId: string,
  key: string,
): Promise<SectionSeats> {
  const id = `${versionId}:${key}`;
  const hit = seatCache.get(id);
  if (hit) {
    // Touch, so an actively-compared section is not the one evicted.
    seatCache.delete(id);
    seatCache.set(id, hit);
    return hit;
  }
  const promise = apiFetch<SectionSeats>(
    `/api/layouts/${versionId}/sections/${key}/seats`,
  ).catch((error) => {
    seatCache.delete(id);
    throw error;
  });
  cacheSeats(id, promise);
  return promise;
}

/** Warm the cache on hover/focus intent, so the drill-in feels instant. */
export function prefetchSection(versionId: string, key: string): void {
  void loadSection(versionId, key).catch(() => {
    /* Prefetch is best-effort; the real fetch will surface any error. */
  });
}

interface Async<T> {
  data: T | null;
  error: ApiCallError | null;
  loading: boolean;
}

export function useOverview(versionId: string | null): Async<VenueOverview> {
  const [state, setState] = useState<Async<VenueOverview>>({
    data: null,
    error: null,
    loading: Boolean(versionId),
  });

  useEffect(() => {
    if (!versionId) return;
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    loadOverview(versionId)
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch(
        (error: ApiCallError) =>
          live && setState({ data: null, error, loading: false }),
      );
    return () => {
      live = false;
    };
  }, [versionId]);

  return state;
}

/**
 * Availability, polled.
 *
 * Polling rather than a socket: these counts are advisory, and one long-lived
 * connection per browsing customer is a real bill at on-sale scale for numbers
 * nobody transacts against. The open section's seat *status* is what needs to
 * be fresh, and that is a separate, much smaller request.
 */
export function useAvailability(
  sessionId: string | null,
  intervalMs = 15_000,
): Async<SessionAvailabilitySnapshot> & { reload: () => void } {
  const [state, setState] = useState<Async<SessionAvailabilitySnapshot>>({
    data: null,
    error: null,
    loading: Boolean(sessionId),
  });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!sessionId) return;
    let live = true;

    const fetchOnce = () =>
      apiFetch<SessionAvailabilitySnapshot>(
        `/api/sessions/${sessionId}/availability`,
      )
        .then((data) => live && setState({ data, error: null, loading: false }))
        .catch(
          (error: ApiCallError) =>
            live && setState((s) => ({ ...s, error, loading: false })),
        );

    void fetchOnce();
    const timer = setInterval(() => {
      // Polling a hidden tab burns the customer's battery for a number they
      // cannot see; the visibility change re-fetches immediately anyway.
      if (document.visibilityState === "visible") void fetchOnce();
    }, intervalMs);

    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [sessionId, intervalMs, nonce]);

  return { ...state, reload };
}

/** Sold/held indices for the open section. Small, so it polls faster. */
export function useSectionStatus(
  sessionId: string | null,
  key: string | null,
  intervalMs = 8_000,
): Async<SectionStatus> & { reload: () => void } {
  const [state, setState] = useState<Async<SectionStatus>>({
    data: null,
    error: null,
    loading: false,
  });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!sessionId || !key) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let live = true;
    setState((s) => ({ ...s, loading: !s.data }));

    const fetchOnce = () =>
      apiFetch<SectionStatus>(
        `/api/sessions/${sessionId}/sections/${key}/status`,
      )
        .then((data) => live && setState({ data, error: null, loading: false }))
        .catch(
          (error: ApiCallError) =>
            live && setState((s) => ({ ...s, error, loading: false })),
        );

    void fetchOnce();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void fetchOnce();
    }, intervalMs);

    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [sessionId, key, intervalMs, nonce]);

  return { ...state, reload };
}

/** The seat artifact for the open section, resolved through the LRU cache. */
export function useSectionSeats(
  versionId: string | null,
  key: string | null,
): Async<SectionSeats> {
  const [state, setState] = useState<Async<SectionSeats>>({
    data: null,
    error: null,
    loading: false,
  });
  const current = useRef<string | null>(null);

  useEffect(() => {
    if (!versionId || !key) {
      current.current = null;
      setState({ data: null, error: null, loading: false });
      return;
    }
    const id = `${versionId}:${key}`;
    current.current = id;
    setState({ data: null, error: null, loading: true });

    loadSection(versionId, key)
      .then((data) => {
        if (current.current === id) setState({ data, error: null, loading: false });
      })
      .catch((error: ApiCallError) => {
        if (current.current === id) setState({ data: null, error, loading: false });
      });
  }, [versionId, key]);

  return state;
}
