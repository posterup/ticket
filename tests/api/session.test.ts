import { it, expect, beforeAll, afterAll } from "vitest";

import { GET as ME } from "@/app/api/auth/me/route";
import { POST as LOGOUT } from "@/app/api/auth/logout/route";
import { POST as REGISTER } from "@/app/api/auth/register/route";
import { POST as CREATE_ORDER } from "@/app/api/orders/route";
import { POST as CANCEL_ORDER } from "@/app/api/orders/[id]/cancel/route";
import type { Order, Workspace } from "@/types";

import {
  ctx,
  data,
  describeApi,
  dropTrackedEvents,
  errorCode,
  parse,
  req,
  signInAs,
  signOut,
  trackEvent,
  trackVenue,
} from "./helpers";

// Remove the throwaway events, venues and orders this suite creates.
afterAll(dropTrackedEvents);

/** Fresh accounts per run, so accumulated workspaces never skew assertions. */
const VISITOR = "09171112233";
const ORGANIZER = "09171114455";

/**
 * Registration makes a real workspace, and nothing removed it: fifty-five
 * «Fresh Studio» workspaces had accumulated, one per run, each with a member
 * row. They inflate every workspace count and every slug-collision search —
 * which is, ironically, exactly what one of these tests measures.
 */
afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");
  const made = await db.workspace.findMany({
    where: { slug: { startsWith: "fresh-studio" } },
    select: { id: true },
  });
  const ids = made.map((w) => w.id);
  if (!ids.length) return;
  await db.workspaceMember.deleteMany({ where: { workspaceId: { in: ids } } });
  await db.workspace.deleteMany({ where: { id: { in: ids } } });
});

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");
  for (const phone of [VISITOR, ORGANIZER]) {
    const user = await db.user.findUnique({ where: { phone } });
    if (!user) continue;
    await db.workspaceMember.deleteMany({ where: { userId: user.id } });
    await db.order.deleteMany({ where: { userId: user.id } });
    await db.session.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});

describeApi("GET /api/auth/me", () => {
  it("reports nulls for an anonymous caller rather than erroring", async () => {
    await signOut();
    const body = data(
      await parse<{ user: unknown; memberships: unknown[] }>(await ME()),
    );
    // The app shell asks this on every page; it must not be an error path.
    expect(body.user).toBeNull();
    expect(body.memberships).toEqual([]);
  });

  it("returns the signed-in user and their workspaces", async () => {
    await signInAs(VISITOR);
    const body = data(
      await parse<{
        user: { phone: string };
        memberships: { slug: string; role: string }[];
      }>(await ME()),
    );
    expect(body.user.phone).toBe(VISITOR);
    // A plain visitor owns nothing — that is what makes them not a manager.
    expect(body.memberships).toEqual([]);
  });
});

describeApi("POST /api/auth/register", () => {
  it("refuses an anonymous caller", async () => {
    await signOut();
    const parsed = await parse(
      await REGISTER(
        req("POST", "/", {
          fullName: "کاربر",
          workspaceName: "Studio",
          workspaceType: "business",
        }),
      ),
    );
    expect(parsed.status).toBe(401);
  });

  it("turns a signed-in visitor into a manager", async () => {
    await signInAs(ORGANIZER);
    // Identity already exists; this is the separate step that creates the
    // workspace — which is what actually confers manager status.
    const before = data(
      await parse<{ memberships: unknown[] }>(await ME()),
    );
    expect(before.memberships).toEqual([]);

    const parsed = await parse<{ workspace: Workspace }>(
      await REGISTER(
        req("POST", "/", {
          fullName: "مدیر تازه",
          workspaceName: "Fresh Studio",
          workspaceType: "business",
        }),
      ),
    );
    expect(parsed.status).toBe(201);
    expect(data(parsed).workspace.type).toBe("business");

    const after = data(
      await parse<{ memberships: { role: string }[] }>(await ME()),
    );
    expect(after.memberships).toHaveLength(1);
    expect(after.memberships[0].role).toBe("owner");
  });

  it("gives a second workspace of the same name a distinct slug", async () => {
    const first = data(
      await parse<{ workspace: Workspace }>(
        await REGISTER(
          req("POST", "/", {
            fullName: "مدیر تازه",
            workspaceName: "Fresh Studio",
            workspaceType: "personal",
          }),
        ),
      ),
    );
    // Slugs are URLs; a collision would silently point at someone else's page.
    expect(first.workspace.slug).not.toBe("fresh-studio");
    expect(first.workspace.slug).toMatch(/^fresh-studio-\d+$/);
  });

  it("rejects an empty workspace name", async () => {
    const parsed = await parse(
      await REGISTER(
        req("POST", "/", {
          fullName: "کاربر",
          workspaceName: "   ",
          workspaceType: "personal",
        }),
      ),
    );
    expect(parsed.status).toBe(400);
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });
});

describeApi("POST /api/auth/logout", () => {
  it("revokes the session so the token cannot be replayed", async () => {
    await signInAs(VISITOR);
    expect(data(await parse<{ user: unknown }>(await ME())).user).not.toBeNull();

    const parsed = await parse<{ signedOut: boolean }>(await LOGOUT());
    expect(parsed.status).toBe(200);
    expect(data(parsed).signedOut).toBe(true);

    // Cookie cleared and the row revoked, so a captured token is worthless.
    expect(data(await parse<{ user: unknown }>(await ME())).user).toBeNull();
  });

  it("succeeds when nobody is signed in", async () => {
    await signOut();
    expect((await parse(await LOGOUT())).status).toBe(200);
  });
});

describeApi("POST /api/orders/:id/cancel", () => {
  async function placeOrder(buyerPhone: string) {
    const { db } = await import("@/lib/server/db");
    const workspace = await db.workspace.findFirstOrThrow({ select: { id: true } });
    const venue = await db.venue.create({
      data: { name: "تالار", city: "تهران", address: "نشانی", capacity: 50 },
    });
  trackVenue(venue.id);
    const event = await db.event.create({
      data: {
        workspaceId: workspace.id,
        venueId: venue.id,
        title: "رویداد لغو",
        description: "",
        mode: "ONE_TIME",
        status: "PUBLISHED",
      },
    });
    trackEvent(event.id);
    const type = await db.ticketType.create({
      data: {
        eventId: event.id,
        name: "عادی",
        price: 100_000,
        capacity: 5,
        salesStartAt: new Date("2020-01-01T00:00:00.000Z"),
        salesEndAt: new Date("2030-01-01T00:00:00.000Z"),
        category: "GENERAL",
      },
    });
    const { order } = data(
      await parse<{ order: Order }>(
        await CREATE_ORDER(
          req("POST", "/", {
            eventId: event.id,
            items: [{ ticketTypeId: type.id, quantity: 2 }],
            buyerName: "سارا",
            buyerPhone,
          }),
        ),
      ),
    );
    return { order, ticketTypeId: type.id };
  }

  it("releases the seats when the buyer cancels", async () => {
    await signInAs(VISITOR);
    const { order, ticketTypeId } = await placeOrder("09121234567");

    const parsed = await parse<Order>(
      await CANCEL_ORDER(req("POST", "/"), ctx({ id: order.id })),
    );
    expect(parsed.status).toBe(200);
    expect(data(parsed).status).toBe("cancelled");

    const { db } = await import("@/lib/server/db");
    const type = await db.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } });
    expect(type.reserved).toBe(0);
    expect(type.sold).toBe(0);
  });

  it("lets a guest cancel by quoting the phone the order used", async () => {
    // Guest checkout has no session, so the phone is the only proof there is.
    await signOut();
    const { order } = await placeOrder("09129876543");

    const parsed = await parse<Order>(
      await CANCEL_ORDER(
        req("POST", "/", { phone: "09129876543" }),
        ctx({ id: order.id }),
      ),
    );
    expect(data(parsed).status).toBe("cancelled");
  });

  it("refuses a stranger with neither a session nor the phone", async () => {
    await signOut();
    const { order } = await placeOrder("09129876543");

    const parsed = await parse<Order>(
      await CANCEL_ORDER(req("POST", "/", { phone: "09120000000" }), ctx({ id: order.id })),
    );
    expect(parsed.status).toBe(403);
    expect(errorCode(parsed)).toBe("FORBIDDEN");
  });

  it("404s an unknown order", async () => {
    const parsed = await parse(
      await CANCEL_ORDER(req("POST", "/"), ctx({ id: "nope" })),
    );
    expect(parsed.status).toBe(404);
  });
});
