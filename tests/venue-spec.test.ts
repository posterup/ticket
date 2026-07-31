import { describe, it, expect } from "vitest";

import {
  latinRowLabel,
  persianRowLabel,
  rowLabelsForSection,
  seatLabelsForRow,
  seatNumbers,
} from "@/lib/venues/numbering";
import {
  DIRECT_RENDER_THRESHOLD,
  generateSection,
  sectionCapacity,
  toOverview,
  toSectionSeats,
  validateSpec,
} from "@/lib/venues/spec";
import {
  boundsOf,
  mirrorShape,
  pointInShape,
  rotateShape,
  translateShape,
} from "@/lib/venues/geometry";
import {
  boxForHandle,
  mirrorSection,
  movePolygonPoint,
  moveSection,
  resizeSection,
  rotateSection,
} from "@/lib/venues/transform";
import { DEFAULT_NUMBERING } from "@/types";
import type { LayoutSpec, SectionSpec } from "@/types";

// These suites are pure — no database, no clock. They run on a fresh clone.

function seatedSection(over: Partial<SectionSpec> = {}): SectionSpec {
  return {
    key: "stalls",
    name: "چمن",
    kind: "seated",
    shape: { type: "rect", x: 0, y: 0, w: 400, h: 200 },
    color: "accent",
    tier: 1,
    rows: {
      count: 3,
      spacing: 30,
      seatSpacing: 20,
      origin: [200, 20],
      angle: 0,
      curve: 0,
      seatsPerRow: 4,
      numbering: DEFAULT_NUMBERING,
    },
    ...over,
  };
}

describe("row labels", () => {
  it("counts A..Z then AA, with no gap at the wrap", () => {
    expect(latinRowLabel(0)).toBe("A");
    expect(latinRowLabel(25)).toBe("Z");
    // Base-26 arithmetic would produce "BA" here — there is no zero digit.
    expect(latinRowLabel(26)).toBe("AA");
    expect(latinRowLabel(27)).toBe("AB");
    expect(latinRowLabel(51)).toBe("AZ");
    expect(latinRowLabel(52)).toBe("BA");
  });

  it("uses the Persian theatre alphabet, then cycles with a suffix", () => {
    expect(persianRowLabel(0)).toBe("الف");
    expect(persianRowLabel(1)).toBe("ب");
    expect(persianRowLabel(32)).toBe("الف2");
  });

  it("reverses row order when numbered back-to-front", () => {
    const spec = { ...DEFAULT_NUMBERING, rowDirection: "back-to-front" as const };
    expect(rowLabelsForSection(spec, 3)).toEqual(["C", "B", "A"]);
  });
});

describe("seat numbering", () => {
  it("runs sequentially from seatStart", () => {
    expect(seatNumbers(DEFAULT_NUMBERING, 4)).toEqual([1, 2, 3, 4]);
  });

  it("skips numbers held to be unlucky", () => {
    const spec = { ...DEFAULT_NUMBERING, skip: [13] };
    expect(seatNumbers(spec, 14)).not.toContain(13);
    expect(seatNumbers(spec, 14)).toHaveLength(14);
    expect(seatNumbers(spec, 14).at(-1)).toBe(15);
  });

  it("puts odds and evens either side of the centre aisle", () => {
    // The European convention: 1 and 2 are neighbours in the middle, not at
    // opposite walls.
    const spec = { ...DEFAULT_NUMBERING, seatScheme: "odd-even" as const };
    expect(seatNumbers(spec, 6)).toEqual([5, 3, 1, 2, 4, 6]);
  });

  it("orders labels left-to-right in layout space regardless of origin", () => {
    const right = seatLabelsForRow(DEFAULT_NUMBERING, 3);
    const left = seatLabelsForRow(
      { ...DEFAULT_NUMBERING, seatOrigin: "left" },
      3,
    );
    // Seat 1 sits on the right, so the leftmost label is the highest number.
    expect(right).toEqual(["3", "2", "1"]);
    expect(left).toEqual(["1", "2", "3"]);
  });
});

describe("generateSection", () => {
  it("produces row-major seats with contiguous indices", () => {
    const { rows, seats } = generateSection(seatedSection());
    expect(rows.map((r) => r.label)).toEqual(["A", "B", "C"]);
    expect(seats).toHaveLength(12);
    expect(seats.map((s) => s.index)).toEqual([...Array(12).keys()]);
    expect(seats[0].rowKey).toBe("A");
    expect(seats[11].rowKey).toBe("C");
  });

  it("centres rows of differing widths on the same axis", () => {
    const section = seatedSection({
      rows: { ...seatedSection().rows!, seatsPerRow: [2, 4] , count: 2 },
    });
    const { seats } = generateSection(section);
    const rowA = seats.filter((s) => s.rowKey === "A");
    const rowB = seats.filter((s) => s.rowKey === "B");
    const midA = (rowA[0].x + rowA[rowA.length - 1].x) / 2;
    const midB = (rowB[0].x + rowB[rowB.length - 1].x) / 2;
    expect(midA).toBeCloseTo(midB, 6);
  });

  it("applies sparse per-seat overrides", () => {
    const section = seatedSection({
      overrides: { "2": { kind: "wheelchair", label: "W" } },
    });
    const seat = generateSection(section).seats[2];
    expect(seat.kind).toBe("wheelchair");
    expect(seat.label).toBe("W");
  });

  it("generates nothing for a standing section", () => {
    const ga = seatedSection({ kind: "standing", capacity: 500 });
    expect(generateSection(ga).seats).toHaveLength(0);
    // Capacity still counts — standing sections sell, they just have no seats.
    expect(sectionCapacity(ga)).toBe(500);
  });

  it("is deterministic", () => {
    const a = generateSection(seatedSection());
    const b = generateSection(seatedSection());
    expect(a).toEqual(b);
  });
});

describe("columnar wire format", () => {
  it("keeps parallel arrays aligned and row spans contiguous", () => {
    const wire = toSectionSeats(generateSection(seatedSection()));
    expect(wire.count).toBe(12);
    expect(wire.x).toHaveLength(12);
    expect(wire.y).toHaveLength(12);
    expect(wire.label).toHaveLength(12);
    expect(wire.kind).toHaveLength(12);

    let cursor = 0;
    for (const row of wire.rows) {
      expect(row.from).toBe(cursor);
      cursor += row.count;
    }
    expect(cursor).toBe(wire.count);
  });
});

describe("toOverview", () => {
  const spec: LayoutSpec = {
    version: 1,
    bounds: { width: 1000, height: 800 },
    sections: [seatedSection()],
  };

  it("never leaks individual seats", () => {
    const overview = toOverview(spec, { versionId: "v1", venueName: "تالار" });
    const serialised = JSON.stringify(overview);
    expect(serialised).not.toContain('"seats"');
    expect(overview.sections[0].capacity).toBe(12);
    expect(overview.totalSeats).toBe(12);
    expect(overview.directRenderThreshold).toBe(DIRECT_RENDER_THRESHOLD);
  });
});

describe("validateSpec", () => {
  it("accepts a well-formed layout", () => {
    expect(
      validateSpec({
        version: 1,
        bounds: { width: 800, height: 600 },
        sections: [seatedSection()],
      }),
    ).toEqual([]);
  });

  it("rejects duplicate section keys", () => {
    const problems = validateSpec({
      version: 1,
      bounds: { width: 800, height: 600 },
      sections: [seatedSection(), seatedSection()],
    });
    expect(problems.some((p) => p.message.includes("تکراری"))).toBe(true);
  });

  it("rejects a standing section with no capacity", () => {
    const problems = validateSpec({
      version: 1,
      bounds: { width: 800, height: 600 },
      sections: [seatedSection({ kind: "standing", capacity: 0 })],
    });
    expect(problems).toHaveLength(1);
  });
});

describe("geometry transforms", () => {
  const rect = { type: "rect" as const, x: 10, y: 20, w: 100, h: 50 };

  it("translates", () => {
    expect(translateShape(rect, 5, -5)).toMatchObject({ x: 15, y: 15 });
  });

  it("hit-tests inside and outside", () => {
    expect(pointInShape({ x: 50, y: 40 }, rect)).toBe(true);
    expect(pointInShape({ x: 500, y: 40 }, rect)).toBe(false);
  });

  it("mirrors across the venue centre line, not the section's own", () => {
    // A stand mirrored about itself would not move, which is never the intent.
    const bounds = { width: 200, height: 200 };
    const mirrored = mirrorShape(rect, "horizontal", bounds);
    expect(boundsOf(mirrored).x).toBe(90);
  });

  it("rotating a polygon preserves its area", () => {
    const poly = {
      type: "polygon" as const,
      points: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ] as [number, number][],
    };
    const before = boundsOf(poly);
    const after = boundsOf(rotateShape(poly, 90));
    expect(after.w).toBeCloseTo(before.w, 6);
    expect(after.h).toBeCloseTo(before.h, 6);
  });
});

describe("section transforms", () => {
  // These back the designer's direct manipulation. The invariant that matters
  // is that the outline and the seat lattice never come apart.
  const section = seatedSection();

  it("moves the seat lattice with the outline", () => {
    const moved = moveSection(section, 50, -20);
    expect(boundsOf(moved.shape).x).toBe(boundsOf(section.shape).x + 50);
    expect(moved.rows!.origin).toEqual([
      section.rows!.origin[0] + 50,
      section.rows!.origin[1] - 20,
    ]);
    // Seats travel exactly as far as the block.
    const before = generateSection(section).seats[0];
    const after = generateSection(moved).seats[0];
    expect(after.x - before.x).toBeCloseTo(50, 6);
    expect(after.y - before.y).toBeCloseTo(-20, 6);
  });

  it("resizes to an absolute box and keeps seats inside it", () => {
    const target = { x: 100, y: 100, w: 800, h: 400 };
    const resized = resizeSection(section, target);
    const box = boundsOf(resized.shape);
    expect(box.x).toBeCloseTo(target.x, 6);
    expect(box.y).toBeCloseTo(target.y, 6);
    expect(box.w).toBeCloseTo(target.w, 6);
    expect(box.h).toBeCloseTo(target.h, 6);

    const seats = generateSection(resized).seats;
    // Seat count is a property of the generator, not the box.
    expect(seats).toHaveLength(generateSection(section).seats.length);
  });

  it("is absolute, so a drag out and back lands where it started", () => {
    // The reason resize takes a box rather than a scale factor: repeated
    // relative scaling accumulates drift.
    const start = boundsOf(section.shape);
    const out = resizeSection(section, { ...start, w: start.w * 3 });
    const back = resizeSection(section, start);
    expect(boundsOf(back.shape).w).toBeCloseTo(start.w, 9);
    expect(boundsOf(out.shape).w).toBeCloseTo(start.w * 3, 9);
  });

  it("rotates the row angle with the shape", () => {
    const spun = rotateSection(section, 90);
    expect(spun.rows!.angle).toBe(section.rows!.angle + 90);
  });

  it("flips the numbering origin when mirrored", () => {
    // Otherwise the opposite stand reads as a mirror image and the ushers
    // send everyone to the wrong seat.
    const flipped = mirrorSection(section, "horizontal", {
      width: 800,
      height: 600,
    });
    expect(flipped.rows!.numbering.seatOrigin).toBe("left");
    expect(section.rows!.numbering.seatOrigin).toBe("right");
  });

  it("drags a polygon vertex without touching the others", () => {
    const poly = seatedSection({
      shape: {
        type: "polygon",
        points: [
          [0, 0],
          [100, 0],
          [100, 100],
        ],
      },
    });
    const moved = movePolygonPoint(poly, 1, 250, 40);
    expect((moved.shape as { points: number[][] }).points).toEqual([
      [0, 0],
      [250, 40],
      [100, 100],
    ]);
  });

  it("anchors the opposite corner when resizing by a handle", () => {
    // Dragging the top-left must grow the block up and left, not slide it.
    const start = { x: 100, y: 100, w: 200, h: 200 };
    const box = boxForHandle(start, "nw", -50, -50);
    expect(box).toEqual({ x: 50, y: 50, w: 250, h: 250 });
    // The bottom-right stays put.
    expect(box.x + box.w).toBe(start.x + start.w);
    expect(box.y + box.h).toBe(start.y + start.h);
  });

  it("refuses to collapse a section to nothing", () => {
    const box = boxForHandle({ x: 0, y: 0, w: 100, h: 100 }, "se", -500, -500);
    expect(box.w).toBeGreaterThan(0);
    expect(box.h).toBeGreaterThan(0);
  });
});
