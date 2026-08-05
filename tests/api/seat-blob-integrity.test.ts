/**
 * What the canvas draws must be what the hold takes.
 *
 * A section carries its geometry twice. `seatBlob` is the columnar artifact the
 * customer's canvas renders — cached forever, keyed by layout version — and
 * `VenueSeat` rows are the identities that holds, order lines and issued
 * tickets refer to. The client picks a *position in the blob* and sends that
 * index to the server, which resolves it against the rows.
 *
 * If the two ever disagree, a buyer clicks one seat and holds another. Nothing
 * errors, nothing looks wrong, and they find out at the door. It is the most
 * invisible bug this subsystem can have, and the compiler that produces both is
 * only unit-tested on its pure output — not on what actually lands in the
 * database.
 */

import { it, expect, beforeAll } from "vitest";

import { describeApi } from "./helpers";

interface Blob {
  count: number;
  x: number[];
  y: number[];
  label: string[];
  kind: number[];
  rows: { key: string; label: string; from: number; count: number }[];
}

interface Section {
  id: string;
  key: string;
  seatCount: number;
  blob: Blob | null;
  seats: { index: number; label: string; x: number; y: number }[];
}

let sections: Section[] = [];

/**
 * `toSectionSeats` rounds coordinates to one decimal to shrink an artifact that
 * is cached forever, so half a tenth is the widest legitimate difference.
 */
const ROUNDING = 0.05;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");
  const rows = await db.venueSection.findMany({
    where: { kind: "SEATED" },
    orderBy: { id: "asc" },
    select: {
      id: true,
      key: true,
      seatCount: true,
      seatBlob: true,
      seats: {
        orderBy: { index: "asc" },
        select: { index: true, label: true, x: true, y: true },
      },
    },
  });
  sections = rows.map((s) => ({
    id: s.id,
    key: s.key,
    seatCount: s.seatCount,
    blob: s.seatBlob as Blob | null,
    seats: s.seats,
  }));
});

describeApi("compiled seat geometry", () => {
  it("has a blob for every seated section", () => {
    expect(sections.length).toBeGreaterThan(0);
    for (const s of sections) expect(s.blob, s.key).not.toBeNull();
  });

  it("agrees with itself on how many seats there are", () => {
    for (const s of sections) {
      expect(s.blob!.count, s.key).toBe(s.seats.length);
      expect(s.seatCount, s.key).toBe(s.seats.length);
      for (const column of ["x", "y", "label", "kind"] as const) {
        expect(s.blob![column].length, `${s.key}.${column}`).toBe(s.blob!.count);
      }
    }
  });

  it("puts the same seat at the same index in both", () => {
    for (const s of sections) {
      const wrong = s.seats.filter((seat, i) => s.blob!.label[i] !== seat.label);
      // The identity check. A shift of one here sells the wrong seat.
      expect(wrong.map((w) => `${s.key}#${w.index}`)).toEqual([]);
    }
  });

  it("keeps positions within the blob's rounding", () => {
    for (const s of sections) {
      const drifted = s.seats.filter(
        (seat, i) =>
          Math.abs(s.blob!.x[i] - seat.x) > ROUNDING ||
          Math.abs(s.blob!.y[i] - seat.y) > ROUNDING,
      );
      expect(drifted.map((d) => `${s.key}#${d.index}`)).toEqual([]);
    }
  });

  it("numbers seats contiguously from zero", () => {
    for (const s of sections) {
      // The wire identity is a section-local ordinal; a gap would make an
      // index ambiguous between the blob's position and the row's value.
      expect(s.seats.map((x) => x.index), s.key).toEqual(
        s.seats.map((_, i) => i),
      );
    }
  });

  it("tiles the section with its row windows, leaving no seat uncovered", () => {
    for (const s of sections) {
      let cursor = 0;
      for (const row of s.blob!.rows) {
        expect(row.from, `${s.key}/${row.key}`).toBe(cursor);
        cursor += row.count;
      }
      // Every seat belongs to exactly one row, or `SeatList` cannot label it.
      expect(cursor, s.key).toBe(s.blob!.count);
    }
  });
});
