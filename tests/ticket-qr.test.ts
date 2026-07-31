/**
 * The QR path builder.
 *
 * The encoding itself belongs to the library; what is ours is the collapse of a
 * module matrix into one SVG path, merging horizontal runs. A bug there prints
 * a code that looks plausible and does not scan — the worst kind, because it is
 * only discovered by someone standing at a door.
 *
 * So this reconstructs the matrix back out of the path and compares it to the
 * matrix that went in, module for module.
 */

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";
import QRCode from "qrcode";

import { toPath } from "@/components/tickets/TicketQr";

/** Replay the path's rectangles onto a blank grid. */
function rasterise(size: number, path: string): Uint8Array {
  const grid = new Uint8Array(size * size);
  const re = /M(\d+) (\d+)h(\d+)v1h-\d+z/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path))) {
    const [x, y, run] = [Number(m[1]), Number(m[2]), Number(m[3])];
    for (let i = 0; i < run; i++) grid[y * size + x + i] = 1;
  }
  return grid;
}

const TOKENS = [
  "QJGE2-Kvo9bNjuHNtmVie6ZOAoQb84_qbYiWmf4SM1Y",
  "c3LNpa4jNXTOGaHuTNdr6fkO-rChJX5kpN0vSycOGVQ",
  // base64url's whole alphabet, including the two characters that distinguish
  // it from base64 and the case pairs an upper-casing bug would collapse.
  "aA-_zZ09bBcCdDeEfFgGhHiIjJkKlLmMnNoOpPqQrRsStT",
];

describe("ticket QR", () => {
  for (const token of TOKENS) {
    it(`renders every module of ${token.slice(0, 8)}…`, () => {
      const qr = QRCode.create(token, { errorCorrectionLevel: "M" });
      const { size, path } = toPath(qr.modules.size, qr.modules.data);

      expect(size).toBe(qr.modules.size);
      expect(rasterise(size, path)).toEqual(
        Uint8Array.from(qr.modules.data),
      );
    });
  }

  it("merges horizontal runs instead of emitting a rect per module", () => {
    const qr = QRCode.create(TOKENS[0], { errorCorrectionLevel: "M" });
    const { path } = toPath(qr.modules.size, qr.modules.data);

    const dark = [...qr.modules.data].filter((b) => b === 1).length;
    const rects = path.match(/M/g)?.length ?? 0;
    // Measured ~2× on real tokens. QR is deliberately high-frequency, so this
    // asserts that merging happens at all rather than a ratio that would drift
    // into a false failure on a different token.
    expect(rects).toBeLessThan(dark * 0.6);
    expect(rects).toBeGreaterThan(0);
  });

  /**
   * The strongest check available without a camera.
   *
   * `qrcode` can emit its own SVG, which is the output every other consumer of
   * this library scans in production. If our geometry — quiet zone included —
   * lands every dark module in the same place as theirs, ours scans too.
   */
  it("places modules exactly where the library's own SVG does", async () => {
    const token = TOKENS[0];
    const qr = QRCode.create(token, { errorCorrectionLevel: "M" });
    const { size, path } = toPath(qr.modules.size, qr.modules.data);

    const QUIET_ZONE = 4;
    const span = size + QUIET_ZONE * 2;
    const reference = await QRCode.toString(token, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: QUIET_ZONE,
    });

    // Their viewBox has to be ours, or the quiet zone differs.
    expect(reference).toContain(`viewBox="0 0 ${span} ${span}"`);

    /**
     * Their path is one `d` of stroked horizontal runs: an absolute `M` and
     * then *relative* `m` hops, each followed by `h<len>`. Treating the
     * relative hops as absolute is the obvious way to misread it.
     */
    const theirs = new Uint8Array(span * span);
    const d = reference.slice(reference.lastIndexOf('d="M') + 3);
    let cx = 0;
    let cy = 0;
    for (const t of d.matchAll(/([Mmh])(-?[\d.]+)(?: (-?[\d.]+))?/g)) {
      const [, op, a, b] = t;
      if (op === "M") {
        cx = Number(a);
        cy = Number(b);
      } else if (op === "m") {
        cx += Number(a);
        cy += Number(b);
      } else {
        // y is the stroke centre (row + 0.5); the run starts at cx.
        const row = Math.floor(cy);
        for (let i = 0; i < Number(a); i++) theirs[row * span + cx + i] = 1;
        cx += Number(a);
      }
    }

    const ours = new Uint8Array(span * span);
    for (const seg of path.matchAll(/M(\d+) (\d+)h(\d+)/g)) {
      const x = Number(seg[1]) + QUIET_ZONE;
      const y = Number(seg[2]) + QUIET_ZONE;
      for (let i = 0; i < Number(seg[3]); i++) ours[y * span + x + i] = 1;
    }

    expect(theirs.some((b) => b === 1)).toBe(true);
    expect(ours).toEqual(theirs);
  });

  it("leaves a blank matrix empty rather than drawing a black square", () => {
    expect(toPath(4, new Uint8Array(16)).path).toBe("");
  });

  it("closes a run that reaches the right edge", () => {
    // Row 0 fully dark: the run has to be flushed by the loop's boundary pass,
    // not by meeting a light module — the case an `x < size` loop drops.
    const data = new Uint8Array(9);
    data[0] = data[1] = data[2] = 1;
    expect(toPath(3, data).path).toBe("M0 0h3v1h-3z");
  });
});

/**
 * How much of a QR actually reaches the scanner.
 *
 * A code is only a code if a camera can resolve its modules. The token is 43
 * base64url characters — byte mode, a 33×33 matrix, 41 modules across with the
 * quiet zone — so the render size divided by 41 is the real number, and it is
 * not obvious from reading `size={72}`.
 *
 * That was the designed ticket's size, giving **1.76 px per module** on the
 * artefact people screenshot and hold up at a door: about 0.47mm printed, under
 * what a cheap door scanner wants, and enough for a messaging app's
 * recompression to blur neighbouring modules together.
 */
describe("the QR is big enough to scan", () => {
  /** Modules across, including the quiet zone `TicketQr` draws. */
  const SPAN = 33 + 4 * 2;

  const sizeIn = (file: string, re: RegExp): number => {
    const m = re.exec(readFileSync(join(process.cwd(), file), "utf8"));
    if (!m) throw new Error(`no TicketQr size found in ${file}`);
    return Number(m[1]);
  };

  it("keeps the designed ticket above 2.5 px per module", () => {
    const size = sizeIn(
      "components/tickets/TicketPreview.tsx",
      /<TicketQr token=\{sample\.qrToken\} size=\{(\d+)\} \/>/,
    );
    expect(size / SPAN).toBeGreaterThanOrEqual(2.5);
  });

  it("keeps the printed order page above 3 px per module", () => {
    // Higher bar: this one is designed to come out of a printer.
    const size = sizeIn(
      "app/orders/[code]/page.tsx",
      /<TicketQr token=\{t\.qrToken\} size=\{(\d+)\} \/>/,
    );
    expect(size / SPAN).toBeGreaterThanOrEqual(3);
  });

  it("assumes the token length the matrix size was derived from", () => {
    // 32 random bytes → 43 base64url chars. A longer token needs a bigger
    // matrix, and every threshold above would quietly become wrong.
    expect(randomBytes(32).toString("base64url")).toHaveLength(43);
  });
});
