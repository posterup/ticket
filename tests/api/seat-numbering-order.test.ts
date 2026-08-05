/**
 * The number on the seat is where the seat is.
 *
 * `seatOrigin` is authored, not inferred — §13.12: which side holds seat 1
 * varies by venue even within Iran, so the compiler is told rather than
 * guessing. That makes it exactly the kind of setting that can be declared one
 * way and compiled the other, with nothing to notice: every seat still exists,
 * the count is right, holds work. Someone walks along row A looking for seat 12
 * and it is at the far end.
 *
 * A rendering bug this is not — it is in the stored labels, so it reaches the
 * printed ticket and the usher's list too.
 */

import { it, expect, beforeAll } from "vitest";

import { describeApi } from "./helpers";

interface RowCheck {
  section: string;
  rowLabel: string;
  declared: string;
  axis: "x" | "y";
  labels: number[];
}

let rows: RowCheck[] = [];

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");

  const sections = await db.venueSection.findMany({
    where: { kind: "SEATED" },
    orderBy: { id: "asc" },
    select: {
      id: true,
      key: true,
      version: { select: { spec: true } },
      rows: {
        orderBy: { index: "asc" },
        select: {
          label: true,
          seats: { select: { label: true, x: true, y: true } },
        },
      },
    },
  });

  rows = sections.flatMap((s) => {
    const spec = s.version.spec as {
      sections: { key: string; rows?: { numbering?: { seatOrigin?: string } } }[];
    };
    const declared =
      spec.sections.find((x) => x.key === s.key)?.rows?.numbering?.seatOrigin ??
      "left";

    return s.rows
      .filter((r) => r.seats.length > 1)
      .map((r) => {
        /**
         * Whichever axis the row actually runs along.
         *
         * A rotated stand (`angle: 90`) runs down the screen, so its seats vary
         * in `y` and barely at all in `x`. Assuming `x` reads the seats in an
         * arbitrary order and reports perfectly good numbering as scrambled —
         * which is what the first version of this check did to the arena's east
         * and west stands.
         */
        const xs = r.seats.map((p) => p.x);
        const ys = r.seats.map((p) => p.y);
        const spanX = Math.max(...xs) - Math.min(...xs);
        const spanY = Math.max(...ys) - Math.min(...ys);
        const axis = spanX >= spanY ? ("x" as const) : ("y" as const);

        const along = [...r.seats].sort((a, b) =>
          axis === "x" ? a.x - b.x : a.y - b.y,
        );
        return {
          section: s.key,
          rowLabel: r.label,
          declared,
          axis,
          labels: along.map((p) => Number(p.label)),
        };
      });
  });
});

describeApi("seat numbering follows the seats", () => {
  it("has rows to check", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it("numbers every row monotonically along its own axis", () => {
    const scrambled = rows.filter((r) => {
      const up = r.labels.every((n, i) => i === 0 || n > r.labels[i - 1]);
      const down = r.labels.every((n, i) => i === 0 || n < r.labels[i - 1]);
      return !(up || down);
    });
    // A gap or a jump means the printed number does not find the chair.
    expect(scrambled.map((r) => `${r.section}/${r.rowLabel}`)).toEqual([]);
  });

  it("runs the direction the layout declared", () => {
    const wrong = rows.filter((r) => {
      const ascends = r.labels[0] < r.labels[r.labels.length - 1];
      // `right` means seat 1 sits at the far end of the axis, so numbers fall
      // as the coordinate grows.
      return r.declared === "right" ? ascends : !ascends;
    });
    expect(wrong.map((r) => `${r.section}/${r.rowLabel}=${r.declared}`)).toEqual(
      [],
    );
  });

  it("covers both directions, so neither is passing by accident", () => {
    const declared = new Set(rows.map((r) => r.declared));
    // The seeded venues include a left-origin section on purpose; without one,
    // a compiler that ignored `seatOrigin` entirely would still pass.
    expect([...declared].sort()).toEqual(["left", "right"]);
  });

  it("covers a rotated stand, where the axis is not x", () => {
    // The case the first version of this check got wrong.
    expect(rows.some((r) => r.axis === "y")).toBe(true);
  });
});
