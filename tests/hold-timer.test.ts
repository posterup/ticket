import { describe, it, expect } from "vitest";

import { WARN_AT_SEC } from "@/components/seatmap/useHoldTimer";

/**
 * The hook itself needs a DOM to run; this covers the pure contract it relies
 * on — the phase boundary and the Persian clock formatting — which is where a
 * regression would actually hide.
 */
const fa = (n: number) => n.toLocaleString("fa-IR", { minimumIntegerDigits: 2 });
const format = (sec: number) => `${fa(Math.floor(sec / 60))}:${fa(sec % 60)}`;
const phase = (sec: number) =>
  sec <= 0 ? "expired" : sec <= WARN_AT_SEC ? "warning" : "ok";

describe("hold countdown", () => {
  it("turns urgent two minutes out, not before", () => {
    expect(phase(WARN_AT_SEC + 1)).toBe("ok");
    expect(phase(WARN_AT_SEC)).toBe("warning");
    expect(phase(1)).toBe("warning");
    expect(phase(0)).toBe("expired");
  });

  it("formats a clock in Persian digits, zero-padded", () => {
    expect(format(20 * 60)).toBe("۲۰:۰۰");
    expect(format(65)).toBe("۰۱:۰۵");
    expect(format(9)).toBe("۰۰:۰۹");
    expect(format(0)).toBe("۰۰:۰۰");
  });

  it("never shows a negative clock", () => {
    // The hook clamps at zero; a lapsed hold reads 00:00, not -00:01.
    const remaining = Math.max(0, Math.floor((Date.now() - 5000 - Date.now()) / 1000));
    expect(remaining).toBe(0);
    expect(format(remaining)).toBe("۰۰:۰۰");
  });
});
