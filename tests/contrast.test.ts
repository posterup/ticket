/**
 * WCAG contrast arithmetic.
 *
 * Checked against published reference values rather than against itself — a
 * luminance formula that is subtly wrong still returns confident numbers, and
 * the whole point of this module is to be trusted when it says a ticket is
 * unreadable.
 */

import { describe, it, expect } from "vitest";

import {
  blend,
  contrastRatio,
  grade,
  inkOn,
  luminance,
  parseHex,
  ticketInk,
} from "@/lib/contrast";

describe("contrast", () => {
  it("matches the reference extremes", () => {
    // The two values the spec itself fixes.
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("is symmetric — order of arguments cannot change a verdict", () => {
    const a = contrastRatio("#e02328", "#ffffff")!;
    const b = contrastRatio("#ffffff", "#e02328")!;
    expect(a).toBeCloseTo(b, 10);
  });

  it("reproduces known token ratios from the design system", () => {
    // These are the numbers recorded in docs/design-system.md; if the formula
    // drifts, the audit and the runtime check stop agreeing.
    expect(contrastRatio("#5b5470", "#fdfcff")!).toBeCloseTo(6.97, 1);
    expect(contrastRatio("#9e89c8", "#ffffff")!).toBeCloseTo(3.06, 1);
    expect(contrastRatio("#ffffff", "#e02328")!).toBeCloseTo(4.73, 1);
  });

  it("uses the sRGB linear branch below the cutoff", () => {
    // The cutoff is channel 10.016/255, so #0a0a0a takes the linear branch and
    // #0b0b0b takes the power curve. An implementation that applied the power
    // curve everywhere would get the first of these wrong.
    expect(luminance(parseHex("#0a0a0a")!)).toBeCloseTo(0.0030353, 6);
    expect(luminance(parseHex("#0b0b0b")!)).toBeCloseTo(0.0033465, 6);
  });

  it("refuses to invent a ratio for an unparseable colour", () => {
    for (const bad of ["red", "#fff", "rgb(0,0,0)", "", "#gggggg"]) {
      expect(contrastRatio(bad, "#ffffff")).toBeUndefined();
    }
    expect(parseHex("#FFFFFF")).toEqual([255, 255, 255]);
  });

  it("grades against the two AA thresholds", () => {
    expect(grade(21)).toBe("pass");
    expect(grade(4.5)).toBe("pass");
    expect(grade(4.49)).toBe("large-only");
    expect(grade(3)).toBe("large-only");
    expect(grade(2.99)).toBe("fail");
    // An unknown ratio must fail, never pass by default.
    expect(grade(undefined)).toBe("fail");
  });

  it("blends alpha the way a browser composites it", () => {
    expect(blend("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(blend("#ffffff", "#000000", 0)).toBe("#000000");
    expect(blend("#123456", "#ffffff", 1)).toBe("#123456");
  });

  it("catches the ticket design that started this", () => {
    // surface: "light" (near-black text) over a near-black custom background —
    // two independent controls that the designer happily allowed together.
    expect(grade(contrastRatio("#171717", "#101820"))).toBe("fail");
    // …and the same background with the dark surface is fine.
    expect(grade(contrastRatio("#ffffff", "#101820"))).toBe("pass");
  });

  /**
   * The accent header, which nothing warned about.
   *
   * The body-text warning above covers the two controls the organiser sets
   * against each other. The header was worse: the organiser picked only the
   * background, and `TicketPreview` hardcoded white on top of it.
   */
  describe("inkOn", () => {
    it("keeps white on every accent the designer presets", () => {
      // The six swatches in TicketDesigner's ACCENTS.
      for (const c of ["#2563EB", "#15803D", "#7C3AED", "#BE123C", "#B45309", "#111111"]) {
        expect(inkOn(c)).toBe("#ffffff");
        expect(grade(contrastRatio(inkOn(c), c))).toBe("pass");
      }
    });

    it("flips to dark ink on the light accents the colour picker allows", () => {
      // White on any of these is 1.0–1.6:1 — the bug this fixes.
      for (const c of ["#FFFF00", "#FFFFFF", "#F5D90A", "#00E5FF", "#7CFC00", "#FFC0CB"]) {
        expect(grade(contrastRatio("#ffffff", c))).toBe("fail");
        expect(inkOn(c)).toBe("#171717");
        expect(grade(contrastRatio(inkOn(c), c))).toBe("pass");
      }
    });

    it("always picks the better of the two inks, across the whole cube", () => {
      // The actual contract. Exhaustive enough to catch a flipped comparison at
      // the crossover, where the two inks are within a hair of each other and
      // choosing the loser is invisible by eye but measurable here.
      let worst = 21;
      for (let r = 0; r < 256; r += 17)
        for (let g = 0; g < 256; g += 17)
          for (let b = 0; b < 256; b += 17) {
            const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
            const chosen = contrastRatio(inkOn(hex), hex)!;
            const other = Math.max(
              contrastRatio("#ffffff", hex)!,
              contrastRatio("#171717", hex)!,
            );
            expect(chosen).toBeCloseTo(other, 10);
            worst = Math.min(worst, chosen);
          }

      /**
       * …and the ceiling that picking well cannot raise.
       *
       * Two inks cannot cover every background. At the crossover luminance
       * (L ≈ 0.200) white and `#171717` are equally bad at **4.19:1**, so a
       * mid-tone accent — a mid green, a denim blue — lands just under the 4.5
       * AA threshold for small text no matter which ink wins. It clears 3:1, so
       * the bold event title is fine; the `text-xs` «بلیت ورود» above it is the
       * part that is technically short.
       *
       * Worth knowing rather than papering over: closing it needs a third ink
       * or a warning on the accent control, not a better comparison here.
       */
      expect(worst).toBeGreaterThanOrEqual(3);
      expect(worst).toBeLessThan(4.5);
    });

    it("falls back to white rather than throwing on junk", () => {
      expect(inkOn("not a colour")).toBe("#ffffff");
      expect(inkOn("")).toBe("#ffffff");
    });
  });

  /**
   * The secondary text ranks, which the designer's warning used to skip.
   */
  describe("ticketInk", () => {
    it("rescues the labels on the mid-grey body that scored a clean pass", () => {
      // The exact design the old check blessed: headline 6.29:1 ("pass"),
      // labels 1.81:1 — three ranks of text, one of them gone.
      expect(grade(contrastRatio("#171717", "#999999"))).toBe("pass");
      expect(grade(contrastRatio("#71688d", "#999999"))).toBe("fail");

      const ink = ticketInk("#999999");
      expect(grade(contrastRatio(ink.label, "#999999"))).not.toBe("fail");
      expect(grade(contrastRatio(ink.muted, "#999999"))).not.toBe("fail");
    });

    it("keeps the ranks in order — label softest, strong boldest", () => {
      for (const bg of ["#ffffff", "#171717", "#999999", "#cccccc", "#1b6df5"]) {
        const { strong, muted, label } = ticketInk(bg);
        const rs = contrastRatio(strong, bg)!;
        const rm = contrastRatio(muted, bg)!;
        const rl = contrastRatio(label, bg)!;
        /**
         * Never inverted — but the ranks are allowed to *converge*.
         *
         * On a background whose solid ink is itself below a rank's floor there
         * is no headroom to spend, so that rank collapses onto the one above
         * it. Losing a shade of hierarchy is the right trade against losing the
         * text; demanding strict inequality here would forbid the floor from
         * ever doing its job.
         */
        expect(rs).toBeGreaterThanOrEqual(rm);
        expect(rm).toBeGreaterThanOrEqual(rl);
      }
      // Where there *is* headroom, the hierarchy is real and not merely legal.
      for (const bg of ["#ffffff", "#171717"]) {
        const { strong, muted, label } = ticketInk(bg);
        expect(contrastRatio(strong, bg)!).toBeGreaterThan(contrastRatio(muted, bg)!);
        expect(contrastRatio(muted, bg)!).toBeGreaterThan(contrastRatio(label, bg)!);
      }
    });

    it("never lets the faintest rank drop below large-text AA", () => {
      let worst = 21;
      for (let r = 0; r < 256; r += 17)
        for (let g = 0; g < 256; g += 17)
          for (let b = 0; b < 256; b += 17) {
            const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
            worst = Math.min(worst, contrastRatio(ticketInk(hex).label, hex)!);
          }
      // Bounded by the same two-ink ceiling as `inkOn`, softened by 0.68 —
      // so this is the floor the designer's warning is now measuring against.
      expect(worst).toBeGreaterThanOrEqual(3);
    });
  });
});
