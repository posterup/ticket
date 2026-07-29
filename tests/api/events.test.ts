import { describe, it, expect } from "vitest";

import { GET, POST } from "@/app/api/events/route";
import {
  GET as GET_ONE,
  PATCH as PATCH_ONE,
} from "@/app/api/events/[id]/route";
import { PATCH as PATCH_VENUE } from "@/app/api/events/[id]/venue/route";
import { POST as POST_SESSION } from "@/app/api/events/[id]/sessions/route";
import { PATCH as PATCH_SESSION } from "@/app/api/events/[id]/sessions/[sessionId]/route";
import type { Event, EventSession, Venue } from "@/types";

import { ctx, data, errorCode, parse, req } from "./helpers";

const SEED_EVENT = "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01";

const validEvent = {
  title: "رویداد آزمایشی",
  description: "توضیح",
  mode: "one-time",
  venue: { name: "تالار", city: "تهران", address: "نشانی", capacity: 100 },
  sessions: [
    { startAt: "2026-10-02T18:30:00.000Z", endAt: "2026-10-02T21:00:00.000Z" },
  ],
  tags: ["تست"],
};

/** Create an event and return it, failing the test if creation errored. */
async function createEvent(overrides: Record<string, unknown> = {}) {
  const res = await POST(req("POST", "/api/events", { ...validEvent, ...overrides }));
  const parsed = await parse<Event>(res);
  expect(parsed.status).toBe(201);
  return data(parsed);
}

describe("GET /api/events", () => {
  it("returns the seeded events", async () => {
    const events = data(await parse<Event[]>(await GET()));
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.id === SEED_EVENT)).toBe(true);
  });

  it("is sorted newest first", async () => {
    const events = data(await parse<Event[]>(await GET()));
    const createdAt = events.map((e) => e.createdAt);
    expect([...createdAt].sort().reverse()).toEqual(createdAt);
  });
});

describe("POST /api/events", () => {
  it("creates a draft event with a venue and sessions", async () => {
    const event = await createEvent();
    expect(event.title).toBe("رویداد آزمایشی");
    expect(event.status).toBe("draft");
    expect(event.venue.name).toBe("تالار");
    expect(event.sessions).toHaveLength(1);
    expect(event.sessions[0].eventId).toBe(event.id);
  });

  it("honours an explicit status", async () => {
    const event = await createEvent({ status: "published" });
    expect(event.status).toBe("published");
  });

  it("rejects a malformed JSON body", async () => {
    const parsed = await parse(await POST(req("POST", "/api/events", "{oops")));
    expect(parsed.status).toBe(400);
    expect(errorCode(parsed)).toBe("INVALID_JSON");
  });

  it("rejects a body missing required fields, naming them", async () => {
    const parsed = await parse(
      await POST(req("POST", "/api/events", { title: "" })),
    );
    expect(parsed.status).toBe(400);
    expect(errorCode(parsed)).toBe("INVALID_BODY");
    if ("error" in parsed.body) {
      const paths = parsed.body.error.details?.map((d) => d.path) ?? [];
      expect(paths).toEqual(
        expect.arrayContaining(["title", "mode", "venue", "sessions"]),
      );
    }
  });

  it("rejects an unknown mode", async () => {
    const parsed = await parse(
      await POST(req("POST", "/api/events", { ...validEvent, mode: "yearly" })),
    );
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("rejects an empty session list", async () => {
    const parsed = await parse(
      await POST(req("POST", "/api/events", { ...validEvent, sessions: [] })),
    );
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });
});

describe("GET /api/events/:id", () => {
  it("resolves a seeded event", async () => {
    const parsed = await parse<Event>(
      await GET_ONE(req("GET", "/"), ctx({ id: SEED_EVENT })),
    );
    expect(data(parsed).id).toBe(SEED_EVENT);
  });

  it("404s an unknown id", async () => {
    const parsed = await parse<Event>(
      await GET_ONE(req("GET", "/"), ctx({ id: "nope" })),
    );
    expect(parsed.status).toBe(404);
    expect(errorCode(parsed)).toBe("NOT_FOUND");
  });
});

describe("PATCH /api/events/:id", () => {
  it("publishes an event", async () => {
    const event = await createEvent();
    const parsed = await parse<Event>(
      await PATCH_ONE(
        req("PATCH", "/", { status: "published" }),
        ctx({ id: event.id }),
      ),
    );
    expect(data(parsed).status).toBe("published");
  });

  it("trims the title", async () => {
    const event = await createEvent();
    const parsed = await parse<Event>(
      await PATCH_ONE(
        req("PATCH", "/", { title: "  عنوان تازه  " }),
        ctx({ id: event.id }),
      ),
    );
    expect(data(parsed).title).toBe("عنوان تازه");
  });

  it("rejects an empty patch", async () => {
    const event = await createEvent();
    const parsed = await parse<Event>(
      await PATCH_ONE(req("PATCH", "/", {}), ctx({ id: event.id })),
    );
    expect(parsed.status).toBe(400);
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("rejects an unknown status", async () => {
    const event = await createEvent();
    const parsed = await parse<Event>(
      await PATCH_ONE(
        req("PATCH", "/", { status: "archived" }),
        ctx({ id: event.id }),
      ),
    );
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("404s an unknown id", async () => {
    const parsed = await parse<Event>(
      await PATCH_ONE(
        req("PATCH", "/", { status: "published" }),
        ctx({ id: "nope" }),
      ),
    );
    expect(parsed.status).toBe(404);
  });
});

describe("PATCH /api/events/:id/venue", () => {
  it("edits venue fields", async () => {
    const event = await createEvent();
    const parsed = await parse<Venue>(
      await PATCH_VENUE(
        req("PATCH", "/", { city: "شیراز", capacity: 250 }),
        ctx({ id: event.id }),
      ),
    );
    const venue = data(parsed);
    expect(venue.city).toBe("شیراز");
    expect(venue.capacity).toBe(250);
    // Untouched fields survive the patch.
    expect(venue.name).toBe("تالار");
  });

  it("rejects a negative capacity", async () => {
    const event = await createEvent();
    const parsed = await parse<Venue>(
      await PATCH_VENUE(
        req("PATCH", "/", { capacity: -1 }),
        ctx({ id: event.id }),
      ),
    );
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("404s an unknown event", async () => {
    const parsed = await parse<Venue>(
      await PATCH_VENUE(req("PATCH", "/", { city: "شیراز" }), ctx({ id: "nope" })),
    );
    expect(parsed.status).toBe(404);
  });
});

describe("sessions", () => {
  it("appends a session", async () => {
    const event = await createEvent();
    const parsed = await parse<EventSession>(
      await POST_SESSION(
        req("POST", "/", {
          startAt: "2026-11-01T18:00:00.000Z",
          endAt: "2026-11-01T20:00:00.000Z",
        }),
        ctx({ id: event.id }),
      ),
    );
    expect(parsed.status).toBe(201);
    expect(data(parsed).eventId).toBe(event.id);
  });

  it("rejects an end before the start", async () => {
    const event = await createEvent();
    const parsed = await parse<EventSession>(
      await POST_SESSION(
        req("POST", "/", {
          startAt: "2026-11-01T20:00:00.000Z",
          endAt: "2026-11-01T18:00:00.000Z",
        }),
        ctx({ id: event.id }),
      ),
    );
    expect(parsed.status).toBe(400);
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("cancels a session", async () => {
    const event = await createEvent();
    const parsed = await parse<EventSession>(
      await PATCH_SESSION(
        req("PATCH", "/", { cancelled: true }),
        ctx({ id: event.id, sessionId: event.sessions[0].id }),
      ),
    );
    expect(data(parsed).cancelled).toBe(true);
  });

  it("404s an unknown session", async () => {
    const event = await createEvent();
    const parsed = await parse<EventSession>(
      await PATCH_SESSION(
        req("PATCH", "/", { cancelled: true }),
        ctx({ id: event.id, sessionId: "nope" }),
      ),
    );
    expect(parsed.status).toBe(404);
  });
});
