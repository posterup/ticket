import { it, expect, beforeAll, afterAll, afterEach } from "vitest";

import { GET, PATCH } from "@/app/api/events/[id]/seatmap/route";
import { POST as HOLD } from "@/app/api/sessions/[id]/holds/route";
import type { HoldResult } from "@/types";

import { ctx, data, describeApi, errorCode, parse, req, signInAsOwner, signOut } from "./helpers";

interface Option {
  versionId: string;
  totalSeats: number;
  sections: { key: string; kind: string }[];
}

let eventId = "";
let sessionId = "";
let ticketTypeId = "";

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");
  await signInAsOwner();

  // A fresh event at the theatre — the seeded ones are already wired up.
  const seeded = await db.event.findFirst({
    where: { status: "PUBLISHED" },
    select: { workspaceId: true },
  });
  const venue = await db.venueLayout.findFirst({ select: { venueId: true } });
  if (!seeded || !venue) return;

  const now = Date.now();
  const created = await db.event.create({
    data: {
      workspaceId: seeded.workspaceId,
      venueId: venue.venueId,
      title: "اتصال نقشه آزمون",
      description: "-",
      status: "PUBLISHED",
      mode: "ONE_TIME",
      sessions: {
        create: { startAt: new Date(now + 864e5), endAt: new Date(now + 9e7) },
      },
      ticketTypes: {
        create: {
          name: "عادی",
          price: 250_000,
          capacity: 500,
          salesStartAt: new Date(now - 864e5),
          salesEndAt: new Date(now + 864e5),
          category: "GENERAL",
        },
      },
    },
    select: { id: true, sessions: { select: { id: true } }, ticketTypes: { select: { id: true } } },
  });
  eventId = created.id;
  sessionId = created.sessions[0].id;
  ticketTypeId = created.ticketTypes[0].id;
});

afterEach(async () => {
  if (!process.env.DATABASE_URL || !sessionId) return;
  const { db } = await import("@/lib/server/db");
  await db.seatHold.deleteMany({ where: { sessionId } });
});

afterAll(async () => {
  if (!process.env.DATABASE_URL || !eventId) return;
  const { db } = await import("@/lib/server/db");
  await db.sessionSectionPricing.deleteMany({ where: { eventId } });
  await db.eventSession.deleteMany({ where: { eventId } });
  await db.ticketType.deleteMany({ where: { eventId } });
  await db.event.deleteMany({ where: { id: eventId } });
  await signOut();
});

describeApi("attaching a seat map to an event", () => {
  it("offers only published layouts for the event's own venue", async () => {
    const options = data(
      await parse<Option[]>(await GET(req("GET", "/"), ctx({ id: eventId }))),
    );
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].totalSeats).toBeGreaterThan(0);
    expect(options[0].sections.length).toBeGreaterThan(0);
  });

  it("adopts a layout and prices every section in one call", async () => {
    const [option] = data(
      await parse<Option[]>(await GET(req("GET", "/"), ctx({ id: eventId }))),
    );
    const parsed = await parse<{ layoutVersionId?: string; priced: number }>(
      await PATCH(
        req("PATCH", "/", {
          sessionId,
          layoutVersionId: option.versionId,
          pricing: option.sections.map((s) => ({
            sectionKey: s.key,
            ticketTypeId,
          })),
        }),
        ctx({ id: eventId }),
      ),
    );
    expect(parsed.status).toBe(200);
    expect(data(parsed).layoutVersionId).toBe(option.versionId);
    expect(data(parsed).priced).toBe(option.sections.length);
  });

  it("makes the showing immediately sellable by seat", async () => {
    // The point of the whole endpoint: design → publish → adopt → sell.
    const seated = data(
      await parse<Option[]>(await GET(req("GET", "/"), ctx({ id: eventId }))),
    )[0].sections.find((s) => s.kind === "seated")!;

    const held = await parse<HoldResult>(
      await HOLD(
        req("POST", "/", { section: seated.key, seats: [3] }),
        ctx({ id: sessionId }),
      ),
    );
    expect(held.status).toBe(201);
    expect(data(held).acquired).toEqual([3]);
  });

  it("refuses a layout belonging to a different venue", async () => {
    const { db } = await import("@/lib/server/db");
    const other = await db.venueLayoutVersion.findFirst({
      where: { layout: { venue: { events: { none: { id: eventId } } } } },
      select: { id: true, layout: { select: { venueId: true } } },
    });
    const mine = await db.event.findUnique({
      where: { id: eventId },
      select: { venueId: true },
    });
    if (!other || other.layout.venueId === mine?.venueId) return;

    const parsed = await parse(
      await PATCH(
        req("PATCH", "/", { sessionId, layoutVersionId: other.id }),
        ctx({ id: eventId }),
      ),
    );
    expect(parsed.status).toBe(400);
  });

  it("will not swap the map once a seat is spoken for", async () => {
    const seated = data(
      await parse<Option[]>(await GET(req("GET", "/"), ctx({ id: eventId }))),
    )[0].sections.find((s) => s.kind === "seated")!;
    await HOLD(
      req("POST", "/", { section: seated.key, seats: [9] }),
      ctx({ id: sessionId }),
    );

    // The seat printed on a ticket has to keep meaning what it meant.
    const parsed = await parse(
      await PATCH(
        req("PATCH", "/", { sessionId, layoutVersionId: null }),
        ctx({ id: eventId }),
      ),
    );
    expect(errorCode(parsed)).toBe("CONFLICT");
  });

  it("is closed to anyone who cannot edit the event", async () => {
    await signOut();
    expect(
      errorCode(await parse(await GET(req("GET", "/"), ctx({ id: eventId })))),
    ).toBe("UNAUTHENTICATED");
    await signInAsOwner();
  });
});
