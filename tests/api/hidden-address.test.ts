/**
 * «نمایش ندادن نشانی» has to actually not show it.
 *
 * The flag was honoured by the event page and by nothing else: `toVenue` mapped
 * the street address straight onto the wire, so `GET /api/events/:id` answered
 * it in full to any unauthenticated caller and it sat in the SSR payload of the
 * public page. Verified against the running server before the fix — the
 * response carried «خیابان حافظ، تالار وحدت» with `hideAddress: true` beside
 * it.
 *
 * An organiser hiding a venue is usually protecting a private address or a
 * safety-sensitive event. "Hidden" that survives `curl` is not hidden.
 */

import { it, expect, beforeAll, afterAll } from "vitest";

import { GET as EVENT } from "@/app/api/events/[id]/route";

import { ctx, data, describeApi, parse, req, trackEvent, trackVenue, dropTrackedEvents } from "./helpers";

let eventId = "";
let venueId = "";

const ADDRESS = "خیابان مخفی، پلاک ۱۲";

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");
  const workspace = await db.workspace.findFirstOrThrow({ select: { id: true } });

  const venue = await db.venue.create({
    data: {
      name: "سالن آزمون نشانی",
      city: "تهران",
      province: "تهران",
      address: ADDRESS,
      capacity: 30,
      lat: 35.7,
      lng: 51.4,
      hideAddress: true,
    },
    select: { id: true },
  });
  venueId = trackVenue(venue.id);

  const event = await db.event.create({
    data: {
      workspaceId: workspace.id,
      venueId,
      title: "آزمون نشانی پنهان",
      description: "",
      mode: "ONE_TIME",
      status: "PUBLISHED",
      sessions: {
        create: {
          startAt: new Date("2026-12-28T18:00:00Z"),
          endAt: new Date("2026-12-28T20:00:00Z"),
        },
      },
    },
    select: { id: true },
  });
  eventId = trackEvent(event.id);
});

afterAll(dropTrackedEvents);

const publicVenue = async () => {
  const parsed = await parse<{ venue: Record<string, unknown> }>(
    await EVENT(req("GET", "/"), ctx({ id: eventId })),
  );
  return data(parsed).venue;
};

describeApi("a venue with its address hidden", () => {
  it("does not put the street address on the wire", async () => {
    const venue = await publicVenue();
    expect(venue.address).toBe("");
    expect(JSON.stringify(venue)).not.toContain("خیابان مخفی");
  });

  it("does not put the coordinates on the wire either", async () => {
    const venue = await publicVenue();
    // A precise pin *is* the address.
    expect(venue.lat).toBeUndefined();
    expect(venue.lng).toBeUndefined();
  });

  it("still says which city, so the event stays findable", async () => {
    const venue = await publicVenue();
    // Hiding a street number is not hiding what city you are in, and discovery
    // filters on city.
    expect(venue.city).toBe("تهران");
    expect(venue.province).toBe("تهران");
    expect(venue.name).toBe("سالن آزمون نشانی");
  });

  it("still tells the client the address is deliberately withheld", async () => {
    const venue = await publicVenue();
    // Otherwise the page cannot tell "hidden" from "not filled in yet".
    expect(venue.hideAddress).toBe(true);
  });

  it("shows the organiser what they are editing", async () => {
    const { getEventById } = await import("@/lib/server/events");
    // The manage-event endpoint reveals, because the venue form below it has
    // to render the address it is about to change. Withholding it there would
    // have quietly blanked the field on save.
    const own = await getEventById(eventId, { reveal: true });
    expect(own?.venue.address).toBe(ADDRESS);
    expect(own?.venue.lat).toBe(35.7);

    // …and the default is still private.
    const publicView = await getEventById(eventId);
    expect(publicView?.venue.address).toBe("");
  });

  it("leaves a normal venue completely alone", async () => {
    const { db } = await import("@/lib/server/db");
    await db.venue.update({
      where: { id: venueId },
      data: { hideAddress: false },
    });
    try {
      const venue = await publicVenue();
      expect(venue.address).toBe(ADDRESS);
      expect(venue.lat).toBe(35.7);
      expect(venue.hideAddress).toBeUndefined();
    } finally {
      await db.venue.update({
        where: { id: venueId },
        data: { hideAddress: true },
      });
    }
  });
});
