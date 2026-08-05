import { it, expect, beforeAll, afterAll, afterEach } from "vitest";

import { GET, POST, DELETE } from "@/app/api/events/[id]/waitlist/route";

import { ctx, data, describeApi, errorCode, parse, req } from "./helpers";

let eventId = "";
let plainEventId = "";

interface Place { id: string; position: number; quantity: number; total: number }

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");
  const base = await db.event.findFirst({
    where: { status: "PUBLISHED" },
    select: { workspaceId: true, venueId: true },
  });
  if (!base) return;

  const made = await db.$transaction([
    db.event.create({
      data: { ...base, title: "صف انتظار آزمون", description: "-", status: "PUBLISHED", mode: "ONE_TIME", waitlist: true },
      select: { id: true },
    }),
    db.event.create({
      data: { ...base, title: "بدون صف آزمون", description: "-", status: "PUBLISHED", mode: "ONE_TIME", waitlist: false },
      select: { id: true },
    }),
  ]);
  eventId = made[0].id;
  plainEventId = made[1].id;
});

afterEach(async () => {
  if (!process.env.DATABASE_URL || !eventId) return;
  const { db } = await import("@/lib/server/db");
  await db.waitlistEntry.deleteMany({ where: { eventId } });
});

afterAll(async () => {
  if (!process.env.DATABASE_URL || !eventId) return;
  const { db } = await import("@/lib/server/db");
  await db.event.deleteMany({ where: { id: { in: [eventId, plainEventId] } } });
});

const join = (phone: string, name = "متقاضی", quantity = 1) =>
  POST(req("POST", "/", { name, phone, quantity }), ctx({ id: eventId }));

/**
 * A GET carrying the lookup phone in a header.
 *
 * It used to be `?phone=`, which writes the number to the access log, the
 * browser history and any outbound `Referer`.
 */
function headed(method: string, path: string, headers: Record<string, string>) {
  return new Request(`http://test.local${path}`, { method, headers });
}

describeApi("waitlist", () => {
  it("hands out places in arrival order", async () => {
    const a = data(await parse<Place>(await join("09120000101")));
    const b = data(await parse<Place>(await join("09120000102")));
    const c = data(await parse<Place>(await join("09120000103")));
    expect([a.position, b.position, c.position]).toEqual([1, 2, 3]);
    expect(c.total).toBe(3);
  });

  it("is idempotent — rejoining does not take a second place", async () => {
    await join("09120000201");
    await join("09120000202");
    const again = data(await parse<Place>(await join("09120000201", "متقاضی", 4)));
    // Same place, updated quantity: re-joining must not jump or lose the queue.
    expect(again.position).toBe(1);
    expect(again.quantity).toBe(4);
    expect(again.total).toBe(2);
  });

  it("treats mobile formats as the same person", async () => {
    await join("09120000301");
    const same = data(await parse<Place>(await join("+989120000301")));
    expect(same.total).toBe(1);
  });

  it("closes the queue when the organiser has not enabled it", async () => {
    const parsed = await parse(
      await POST(
        req("POST", "/", { name: "متقاضی", phone: "09120000401", quantity: 1 }),
        ctx({ id: plainEventId }),
      ),
    );
    expect(errorCode(parsed)).toBe("CONFLICT");
  });

  it("lets someone look up their own place without a session", async () => {
    await join("09120000501");
    await join("09120000502");
    const mine = data(
      await parse<Place | null>(
        await GET(headed("GET", "/", { "x-waitlist-phone": "09120000502" }), ctx({ id: eventId })),
      ),
    );
    expect(mine?.position).toBe(2);
  });

  it("returns nothing for a phone that never joined", async () => {
    const none = data(
      await parse<Place | null>(
        await GET(headed("GET", "/", { "x-waitlist-phone": "09129999999" }), ctx({ id: eventId })),
      ),
    );
    expect(none).toBeNull();
  });

  it("keeps the organiser list private", async () => {
    // No phone header means "give me the queue", which is names and numbers.
    const parsed = await parse(await GET(req("GET", "/"), ctx({ id: eventId })));
    expect(["UNAUTHENTICATED", "FORBIDDEN"]).toContain(errorCode(parsed));
  });

  it("closes the gap when someone leaves", async () => {
    await join("09120000601");
    await join("09120000602");
    await DELETE(req("DELETE", "/?phone=09120000601"), ctx({ id: eventId }));

    const promoted = data(
      await parse<Place | null>(
        await GET(headed("GET", "/", { "x-waitlist-phone": "09120000602" }), ctx({ id: eventId })),
      ),
    );
    // Position is derived from arrival order, so nothing needs renumbering.
    expect(promoted?.position).toBe(1);
  });
});
