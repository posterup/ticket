import { it, expect, beforeAll, afterEach } from "vitest";

import { GET as OVERVIEW } from "@/app/api/layouts/[versionId]/overview/route";
import { GET as SECTION_SEATS } from "@/app/api/layouts/[versionId]/sections/[key]/seats/route";
import { GET as AVAILABILITY } from "@/app/api/sessions/[id]/availability/route";
import { GET as SECTION_STATUS } from "@/app/api/sessions/[id]/sections/[key]/status/route";
import {
  GET as LIST_HOLDS,
  POST as HOLD,
  DELETE as RELEASE,
} from "@/app/api/sessions/[id]/holds/route";
import { GET as ADMIN_VENUES } from "@/app/api/admin/venues/route";
import type {
  HoldResult,
  SectionSeats,
  SectionStatus,
  SessionAvailabilitySnapshot,
  VenueOverview,
} from "@/types";

import {
  ctx,
  data,
  describeApi,
  errorCode,
  parse,
  req,
  signInAsOwner,
  signOut,
} from "./helpers";

let versionId = "";
let sessionId = "";
/**
 * Resolved from the fixture, not hardcoded.
 *
 * More than one seeded showing has a seat map now, and they are different
 * venues with different section keys — pinning a name here makes the suite fail
 * on whichever layout `findFirst` happened to return.
 */
let section = "";
/** A seat index comfortably inside that section. */
let seat = 0;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");

  const session = await db.eventSession.findFirst({
    where: { layoutVersionId: { not: null } },
    select: { id: true, layoutVersionId: true },
  });
  if (!session?.layoutVersionId) return;
  sessionId = session.id;
  versionId = session.layoutVersionId;

  // The biggest seated section in whatever layout this is.
  const biggest = await db.venueSection.findFirst({
    where: { versionId, kind: "SEATED" },
    orderBy: { seatCount: "desc" },
    select: { key: true, seatCount: true },
  });
  section = biggest?.key ?? "";
  seat = Math.min(50, Math.max(1, (biggest?.seatCount ?? 2) - 1));
});

// Holds accumulate across a full run, so each test clears its own.
afterEach(async () => {
  if (!process.env.DATABASE_URL || !sessionId) return;
  const { db } = await import("@/lib/server/db");
  await db.seatHold.deleteMany({ where: { sessionId } });
});

describeApi("GET /api/layouts/:versionId/overview", () => {
  it("returns section geometry and never individual seats", async () => {
    const parsed = await parse<VenueOverview>(
      await OVERVIEW(req("GET", "/"), ctx({ versionId })),
    );
    expect(parsed.status).toBe(200);

    const overview = data(parsed);
    expect(overview.sections.length).toBeGreaterThan(0);
    expect(overview.totalSeats).toBeGreaterThan(0);

    // The load-bearing guarantee of the whole design.
    const serialised = JSON.stringify(overview);
    expect(serialised).not.toContain('"seats"');
    expect(serialised).not.toContain('"seatBlob"');
  });

  it("is small enough to be the first paint", async () => {
    const parsed = await parse<VenueOverview>(
      await OVERVIEW(req("GET", "/"), ctx({ versionId })),
    );
    // A venue of any size must fit in a couple of packets — that is what buys
    // the instant orientation step.
    expect(JSON.stringify(data(parsed)).length).toBeLessThan(20_000);
  });

  it("is cacheable forever, because the version id pins it", async () => {
    const res = await OVERVIEW(req("GET", "/"), ctx({ versionId }));
    expect(res.headers.get("cache-control")).toContain("immutable");
  });

  it("404s an unknown version", async () => {
    const parsed = await parse(
      await OVERVIEW(req("GET", "/"), ctx({ versionId: "nope" })),
    );
    expect(errorCode(parsed)).toBe("NOT_FOUND");
  });
});

describeApi("GET /api/layouts/:versionId/sections/:key/seats", () => {
  it("returns columnar arrays that stay aligned", async () => {
    const parsed = await parse<SectionSeats>(
      await SECTION_SEATS(req("GET", "/"), ctx({ versionId, key: section })),
    );
    const seats = data(parsed);

    expect(seats.count).toBeGreaterThan(0);
    expect(seats.x).toHaveLength(seats.count);
    expect(seats.y).toHaveLength(seats.count);
    expect(seats.label).toHaveLength(seats.count);
    expect(seats.kind).toHaveLength(seats.count);

    // Row spans must tile the seat array exactly, with no gap or overlap.
    let cursor = 0;
    for (const row of seats.rows) {
      expect(row.from).toBe(cursor);
      cursor += row.count;
    }
    expect(cursor).toBe(seats.count);
  });
});

describeApi("GET /api/sessions/:id/availability", () => {
  it("reports a bucketed indicator per section", async () => {
    const parsed = await parse<SessionAvailabilitySnapshot>(
      await AVAILABILITY(req("GET", "/"), ctx({ id: sessionId })),
    );
    const snapshot = data(parsed);
    expect(snapshot.sections.length).toBeGreaterThan(0);
    for (const section of snapshot.sections) {
      expect(["available", "limited", "almost-full", "sold-out"]).toContain(
        section.indicator,
      );
    }
    // Clients need to know how old the number is; it is advisory, not truth.
    expect(snapshot.asOf).toBeTruthy();
  });
});

describeApi("POST /api/sessions/:id/holds", () => {
  it("holds a free seat and reflects it in the section status", async () => {
    const parsed = await parse<HoldResult>(
      await HOLD(
        req("POST", "/", { section, seats: [seat] }),
        ctx({ id: sessionId }),
      ),
    );
    expect(parsed.status).toBe(201);
    expect(data(parsed).acquired).toEqual([seat]);

    const status = data(
      await parse<SectionStatus>(
        await SECTION_STATUS(req("GET", "/"), ctx({ id: sessionId, key: section })),
      ),
    );
    expect(status.held).toContain(seat);
    expect(status.sold).not.toContain(seat);
  });

  it("lets exactly one of many concurrent buyers win the same seat", async () => {
    // The whole reason holds exist. Tested against `holdSeats` rather than the
    // route because the route derives one holder key per *browser*, and in
    // process every call shares a cookie jar — which would make this ten
    // clicks by one customer, not ten customers racing.
    const { holdSeats } = await import("@/lib/server/venues/holds");

    // Fired together; serialising them would test nothing but the happy path.
    const attempts = Array.from({ length: 10 }, (_, i) =>
      holdSeats({
        sessionId,
        section,
        seats: [seat + 1],
        holderKey: `anon:racer-${i}`,
      })
        .then(() => "won" as const)
        .catch((e: { code?: string }) => e.code ?? "error"),
    );
    const results = await Promise.all(attempts);

    expect(results.filter((r) => r === "won")).toHaveLength(1);
    expect(results.filter((r) => r === "SEAT_TAKEN")).toHaveLength(9);
  });

  it("splits an overlapping pair without giving a seat to both", async () => {
    /**
     * The subtler race, and the one `holdSeats` documents: two buyers reach for
     * ranges that overlap. Partial success is the intended answer — taking
     * three of four and saying which one went beats dropping all four — but it
     * is only correct if the *same* seat never lands in both replies.
     *
     * The single-seat race above cannot catch that: with one seat there is
     * nothing to split.
     */
    const { holdSeats } = await import("@/lib/server/venues/holds");
    const base = seat + 20;
    const left = [base, base + 1, base + 2, base + 3];
    const right = [base + 2, base + 3, base + 4, base + 5];

    const [a, b] = await Promise.all([
      holdSeats({ sessionId, section, seats: left, holderKey: "anon:left" })
        .then((r) => r.acquired)
        .catch(() => [] as number[]),
      holdSeats({ sessionId, section, seats: right, holderKey: "anon:right" })
        .then((r) => r.acquired)
        .catch(() => [] as number[]),
    ]);

    // Nobody holds a seat the other also holds.
    expect(a.filter((x) => b.includes(x))).toEqual([]);
    // And between them they took every seat that was free — a race must not
    // lose inventory to nobody.
    expect([...new Set([...a, ...b])].sort((x, y) => x - y)).toEqual(
      [...new Set([...left, ...right])].sort((x, y) => x - y),
    );
  });

  it("is idempotent for the same buyer clicking twice", async () => {
    // Re-affirming your own hold must not 409 — a double tap or a retry after
    // a flaky network should not look like losing the seat.
    const first = await parse<HoldResult>(
      await HOLD(
        req("POST", "/", { section, seats: [seat + 2] }),
        ctx({ id: sessionId }),
      ),
    );
    const second = await parse<HoldResult>(
      await HOLD(
        req("POST", "/", { section, seats: [seat + 2] }),
        ctx({ id: sessionId }),
      ),
    );
    expect(data(first).acquired).toEqual([seat + 2]);
    expect(data(second).acquired).toEqual([seat + 2]);
  });

  it("reports partial success rather than dropping the whole selection", async () => {
    const { db } = await import("@/lib/server/db");
    const sec = await db.venueSection.findFirst({
      where: { versionId, key: section },
      select: { id: true },
    });
    const taken = await db.venueSeat.findFirst({
      where: { sectionId: sec!.id, index: seat + 3 },
      select: { id: true },
    });
    // Someone else already has seat 7.
    await db.seatHold.create({
      data: {
        sessionId,
        seatId: taken!.id,
        holderKey: "anon:someone-else",
        expiresAt: new Date(Date.now() + 600_000),
      },
    });

    const result = data(
      await parse<HoldResult>(
        await HOLD(
          req("POST", "/", { section, seats: [seat + 3, seat + 4] }),
          ctx({ id: sessionId }),
        ),
      ),
    );
    // Losing one seat must not cost the customer the other.
    expect(result.acquired).toEqual([seat + 4]);
    expect(result.rejected).toEqual([seat + 3]);
  });

  it("steals a lapsed hold", async () => {
    const { db } = await import("@/lib/server/db");
    const sec = await db.venueSection.findFirst({
      where: { versionId, key: section },
      select: { id: true },
    });
    const seatRow = await db.venueSeat.findFirst({
      where: { sectionId: sec!.id, index: seat + 5 },
      select: { id: true },
    });
    await db.seatHold.create({
      data: {
        sessionId,
        seatId: seatRow!.id,
        holderKey: "anon:abandoned",
        expiresAt: new Date(Date.now() - 1_000),
      },
    });

    const result = data(
      await parse<HoldResult>(
        await HOLD(
          req("POST", "/", { section, seats: [seat + 5] }),
          ctx({ id: sessionId }),
        ),
      ),
    );
    expect(result.acquired).toEqual([seat + 5]);
  });

  it("refuses a seat that is already sold", async () => {
    const { db } = await import("@/lib/server/db");
    const sec = await db.venueSection.findFirst({
      where: { versionId, key: section },
      select: { id: true },
    });
    const seatRow = await db.venueSeat.findFirst({
      where: { sectionId: sec!.id, index: seat + 6 },
      select: { id: true },
    });
    await db.seatStatus.create({
      data: { sessionId, seatId: seatRow!.id, state: "SOLD" },
    });

    const parsed = await parse<HoldResult>(
      await HOLD(
        req("POST", "/", { section, seats: [seat + 6] }),
        ctx({ id: sessionId }),
      ),
    );
    expect(errorCode(parsed)).toBe("SEAT_TAKEN");

    await db.seatStatus.deleteMany({ where: { sessionId, seatId: seatRow!.id } });
  });

  it("caps how many seats one holder can sit on", async () => {
    // Holding is free; without a ceiling one script takes the show off sale.
    const parsed = await parse(
      await HOLD(
        req("POST", "/", {
          section: "stalls",
          seats: [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70],
        }),
        ctx({ id: sessionId }),
      ),
    );
    // 11 seats trips the schema's own max before it reaches the limiter.
    expect(parsed.status).toBe(400);
  });

  it("404s a section that does not exist", async () => {
    const parsed = await parse(
      await HOLD(
        req("POST", "/", { section: "not-a-section", seats: [1] }),
        ctx({ id: sessionId }),
      ),
    );
    expect(errorCode(parsed)).toBe("NOT_FOUND");
  });
});

describeApi("DELETE /api/sessions/:id/holds", () => {
  it("releases the caller's own seats and frees them for others", async () => {
    await HOLD(
      req("POST", "/", { section, seats: [seat + 7, seat + 8] }),
      ctx({ id: sessionId }),
    );

    const held = data(
      await parse<{ section: string; seats: number[] }[]>(
        await LIST_HOLDS(req("GET", "/"), ctx({ id: sessionId })),
      ),
    );
    expect(held[0].seats).toEqual([seat + 7, seat + 8]);

    const released = data(
      await parse<{ released: number }>(
        await RELEASE(req("DELETE", "/"), ctx({ id: sessionId })),
      ),
    );
    expect(released.released).toBe(2);

    const after = data(
      await parse<SectionStatus>(
        await SECTION_STATUS(req("GET", "/"), ctx({ id: sessionId, key: section })),
      ),
    );
    expect(after.held).toEqual([]);
  });
});

describeApi("GET /api/admin/venues", () => {
  it("is closed to organisers and open to platform staff", async () => {
    await signOut();
    expect(errorCode(await parse(await ADMIN_VENUES()))).toBe("UNAUTHENTICATED");

    const { db } = await import("@/lib/server/db");
    const userId = await signInAsOwner();

    await db.user.update({
      where: { id: userId },
      data: { platformAdmin: false },
    });
    expect(errorCode(await parse(await ADMIN_VENUES()))).toBe("FORBIDDEN");

    await db.user.update({
      where: { id: userId },
      data: { platformAdmin: true },
    });
    const parsed = await parse<unknown[]>(await ADMIN_VENUES());
    expect(parsed.status).toBe(200);
    expect(data(parsed).length).toBeGreaterThan(0);

    await signOut();
  });
});
