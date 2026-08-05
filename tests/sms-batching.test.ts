/**
 * Campaign sends against a stubbed operator.
 *
 * No database and no live account: `fetch` is replaced, so these assert the two
 * things that were actually wrong — a segment larger than one operator request
 * failed in full, and the reported delivery count was the size of the *request*
 * rather than of the response.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  combineBatches,
  inBatches,
  SMS_BATCH_SIZE,
} from "@/lib/server/sms/gateway";
import { createKavenegarGateway } from "@/lib/server/sms/kavenegar";

/** `count` distinct valid Iranian mobiles. */
const mobiles = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => `09${String(120000000 + i)}`);

/** A Kavenegar 200 whose `entries` says how many were really accepted. */
const accepted = (n: number) =>
  new Response(
    JSON.stringify({ return: { status: 200, message: "OK" }, entries: Array(n).fill({}) }),
    { status: 200 },
  );

const rejected = (status: number, message: string) =>
  new Response(JSON.stringify({ return: { status, message } }), { status: 200 });

describe("inBatches", () => {
  it("splits on the operator ceiling and loses nobody", () => {
    const all = mobiles(450);
    const batches = inBatches(all);
    expect(batches).toHaveLength(3);
    expect(batches.map((b) => b.length)).toEqual([200, 200, 50]);
    expect(batches.flat()).toEqual(all);
  });

  it("keeps a single call a single call", () => {
    expect(inBatches(mobiles(SMS_BATCH_SIZE))).toHaveLength(1);
    expect(inBatches([])).toEqual([]);
  });

  it("refuses a batch size that would never terminate", () => {
    expect(() => inBatches([1, 2, 3], 0)).toThrow(RangeError);
  });
});

describe("combineBatches", () => {
  it("reports the partial total when one batch fails", () => {
    const r = combineBatches([
      { ok: true, sent: 200 },
      { ok: false, sent: 0, error: "اعتبار کافی نیست" },
      { ok: true, sent: 50 },
    ]);
    // Not 250, and not 0 — 250 went, and the organiser is told it failed.
    expect(r).toEqual({ ok: false, sent: 250, error: "اعتبار کافی نیست" });
  });

  it("is ok only when every batch is", () => {
    expect(combineBatches([{ ok: true, sent: 5 }, { ok: true, sent: 3 }])).toEqual({
      ok: true,
      sent: 8,
    });
  });
});

describe("the Kavenegar gateway over a stubbed operator", () => {
  const env = { ...process.env };
  let calls: { receptors: string[] }[] = [];

  beforeEach(() => {
    process.env.KAVENEGAR_API_KEY = "test-key";
    delete process.env.KAVENEGAR_SENDER;
    calls = [];
  });

  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  /** Record each request and answer with `reply(batchSize, callIndex)`. */
  function stubOperator(reply: (size: number, index: number) => Response) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const params = new URLSearchParams(String(init.body));
        const receptors = (params.get("receptor") ?? "").split(",").filter(Boolean);
        calls.push({ receptors });
        return reply(receptors.length, calls.length - 1);
      }),
    );
  }

  it("splits a segment too large for one request instead of failing it", async () => {
    stubOperator((size) => accepted(size));

    const result = await createKavenegarGateway().sendBulk(mobiles(450), "سلام");

    // The whole point: three requests, nobody dropped, and it succeeded.
    expect(calls).toHaveLength(3);
    expect(calls.map((c) => c.receptors.length)).toEqual([200, 200, 50]);
    expect(result).toEqual({ ok: true, sent: 450 });
    // No receptor sent twice — `validRecipients` dedupes, batching must not undo it.
    const flat = calls.flatMap((c) => c.receptors);
    expect(new Set(flat).size).toBe(450);
  });

  it("counts what the operator accepted, not what was asked", async () => {
    // 200 requested, operator silently drops 3 — `return.status` is still 200.
    stubOperator((size) => accepted(size - 3));

    const result = await createKavenegarGateway().sendBulk(mobiles(200), "سلام");

    expect(result).toEqual({ ok: true, sent: 197 });
  });

  it("keeps the messages that went when a later batch is refused", async () => {
    stubOperator((size, i) =>
      i === 1 ? rejected(418, "اعتبار حساب کافی نیست") : accepted(size),
    );

    const result = await createKavenegarGateway().sendBulk(mobiles(450), "سلام");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("اعتبار حساب کافی نیست");
    // Batches 0 and 2 landed; reporting 0 would understate it as badly as
    // reporting 450 would overstate it.
    expect(result.sent).toBe(250);
  });

  it("still refuses a send with no configured key", async () => {
    delete process.env.KAVENEGAR_API_KEY;
    stubOperator((size) => accepted(size));

    const result = await createKavenegarGateway().sendBulk(mobiles(10), "سلام");

    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

/**
 * What batching did to the callers that assumed it was all-or-nothing.
 *
 * `sendBulk` used to be one request: `ok` meant everyone, `!ok` meant nobody.
 * Batching kept the name and changed the contract — `{ ok: false, sent: 250 }`
 * now means 250 people *were* reached. Every `if (!result.ok) return` written
 * against the old meaning became a bug the moment the list crossed 200.
 *
 * `notifyWaitlist` was the one that mattered: it recorded `notifiedAt` only on
 * a clean run, so a partial send announced 250 people's turn and recorded none
 * of them — leaving them at the head of the queue to be texted and billed again
 * on the next opening, while everyone behind them starved.
 */
describe("callers that must not assume all-or-nothing", () => {
  /**
   * Comments stripped before matching.
   *
   * These assertions are about what the code does, and the comment explaining
   * this very change *quotes the old line* to say what it replaced. A negative
   * match against the raw file therefore fails on the documentation rather than
   * on the behaviour — the assertion has to read what runs.
   */
  const read = (p: string) =>
    readFileSync(join(process.cwd(), p), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");

  it("marks waitlist entries per batch, not per run", () => {
    const src = read("lib/server/waitlist.ts");
    expect(src).toMatch(/for \(const batch of inBatches\(reached\)\)/);
    // The whole-run gate is what made a partial send record nothing.
    expect(src).not.toMatch(/if \(!sent\.ok\) return \{ notified: 0 \}/);
  });

  it("records exactly the batch it just sent", () => {
    const src = read("lib/server/waitlist.ts");
    expect(src).toMatch(/phone: \{ in: batch \}/);
    expect(src).not.toMatch(/phone: \{ in: reached \}/);
  });

  it("stops after a failing batch rather than pressing on", () => {
    // An operator that just refused will refuse the next one; continuing bills
    // for attempts and delays the error the organiser needs to see.
    expect(read("lib/server/waitlist.ts")).toMatch(/if \(!sent\.ok\) break;/);
  });
});
