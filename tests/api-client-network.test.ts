import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiCallError, apiFetch } from "@/lib/client/api";

/**
 * A request that never reached a server must still speak Persian.
 *
 * `apiFetch` awaited `fetch` unguarded, so a genuine network failure rejected
 * with the browser's own `TypeError: Failed to fetch` and that object travelled
 * all the way out to `AsyncState`, which renders `error.message`. The result was
 * an English sentence in the middle of a Persian page, reachable from every
 * client-fetched screen — the event page, checkout, the ticket wallet, the
 * order page.
 *
 * The quieter half of the same bug: a `TypeError` carries no `code`, so the
 * `code === "NETWORK"` branch that shows `offlineHint` never matched. The hint
 * exists for a reader standing at a door with no signal, and it was dead in
 * exactly that case.
 */
describe("apiFetch when the request never reaches a server", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("translates a rejected fetch into a Persian NETWORK error", async () => {
    // The exact rejection Chrome produces when it cannot open the connection.
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));

    const err = await apiFetch("/api/anything").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiCallError);
    const api = err as ApiCallError;
    expect(api.message).toBe("ارتباط با سرور برقرار نشد.");
    // Not the browser's wording, in any casing.
    expect(api.message).not.toMatch(/failed to fetch/i);
    // The code the `offlineHint` branch keys on.
    expect(api.code).toBe("NETWORK");
    // No response arrived, so there is no status to report.
    expect(api.status).toBe(0);
  });

  it("still surfaces the server's own message when one arrives", () => {
    // The guard must not swallow real API errors into a generic network one.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        error: { code: "NOT_FOUND", message: "سفارش یافت نشد." },
      }),
    } as unknown as Response);

    return apiFetch("/api/orders/nope").catch((e: unknown) => {
      const api = e as ApiCallError;
      expect(api.code).toBe("NOT_FOUND");
      expect(api.message).toBe("سفارش یافت نشد.");
      expect(api.status).toBe(404);
    });
  });

  it("falls back to Persian when a failing response carries no envelope", async () => {
    // A proxy or gateway returning HTML: `res.json()` throws, `body` stays null.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    } as unknown as Response);

    const err = (await apiFetch("/api/anything").catch(
      (e: unknown) => e,
    )) as ApiCallError;

    expect(err.message).toBe("ارتباط با سرور برقرار نشد.");
    expect(err.code).toBe("NETWORK");
    expect(err.status).toBe(502);
  });
});
