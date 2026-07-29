import { it, expect, beforeAll } from "vitest";

import { POST as ADD_COLLAB } from "@/app/api/events/[id]/collaborators/route";
import { PATCH as RESPOND } from "@/app/api/events/[id]/collaborators/[collabId]/route";
import { GET as MY_INVITES } from "@/app/api/me/invites/route";
import { PATCH as PATCH_EVENT } from "@/app/api/events/[id]/route";
import type { Event, EventCollaborator } from "@/types";

import {
  ctx,
  data,
  describeApi,
  errorCode,
  parse,
  req,
  signInAs,
  signInAsOwner,
  signOut,
} from "./helpers";

/** ava-events owns the events here; negar-karimi's owner is the outsider. */
const AVA_OWNER = "09120000001";
const NEGAR_OWNER = "09120000002";

/**
 * A fresh ava-events event per test.
 *
 * Grants accumulate — an invite accepted by one test would still be granting
 * access in the next — so each test gets its own event rather than sharing a
 * fixture.
 */
async function freshEvent(): Promise<string> {
  const { db } = await import("@/lib/server/db");
  const workspace = await db.workspace.findFirstOrThrow({
    where: { slug: "ava-events" },
    select: { id: true },
  });
  const venue = await db.venue.create({
    data: { name: "تالار", city: "تهران", address: "نشانی", capacity: 50 },
  });
  const event = await db.event.create({
    data: {
      workspaceId: workspace.id,
      venueId: venue.id,
      title: "رویداد همکاری",
      description: "",
      mode: "ONE_TIME",
      status: "DRAFT",
    },
  });
  return event.id;
}

async function invite(eventId: string, overrides: Record<string, unknown> = {}) {
  await signInAs(AVA_OWNER);
  return data(
    await parse<EventCollaborator>(
      await ADD_COLLAB(
        req("POST", "/", {
          channel: "workspace",
          label: "نگار کریمی",
          sub: "@negar-karimi",
          workspaceSlug: "negar-karimi",
          ...overrides,
        }),
        ctx({ id: eventId }),
      ),
    ),
  );
}

beforeAll(async () => {
  if (process.env.DATABASE_URL) await signInAsOwner();
});

describeApi("inviting", () => {
  it("creates a pending co-host by default", async () => {
    const AVA_EVENT = await freshEvent();
    const collab = await invite(AVA_EVENT);
    expect(collab.status).toBe("pending");
    expect(collab.role).toBe("co-host");
  });

  it("can invite someone to the door only", async () => {
    const AVA_EVENT = await freshEvent();
    const collab = await invite(AVA_EVENT, { role: "checkin" });
    expect(collab.role).toBe("checkin");
  });
});

describeApi("responding to an invite", () => {
  it("grants access only once the invitee accepts", async () => {
    const AVA_EVENT = await freshEvent();
    const collab = await invite(AVA_EVENT);

    // Before accepting, the invited organiser is still an outsider — this is
    // the whole point of resolving the invitee on acceptance.
    await signInAs(NEGAR_OWNER);
    const before = await parse<Event>(
      await PATCH_EVENT(
        req("PATCH", "/", { description: "از سوی همکار" }),
        ctx({ id: AVA_EVENT }),
      ),
    );
    expect(before.status).toBe(403);

    const accepted = data(
      await parse<EventCollaborator>(
        await RESPOND(
          req("PATCH", "/", { action: "accept" }),
          ctx({ id: AVA_EVENT, collabId: collab.id }),
        ),
      ),
    );
    expect(accepted.status).toBe("accepted");

    // Now the co-host grant applies.
    const after = await parse<Event>(
      await PATCH_EVENT(
        req("PATCH", "/", { description: "از سوی همکار" }),
        ctx({ id: AVA_EVENT }),
      ),
    );
    expect(after.status).toBe(200);
  });

  it("still withholds what a co-host must never have", async () => {
    const AVA_EVENT = await freshEvent();
    const collab = await invite(AVA_EVENT);
    await signInAs(NEGAR_OWNER);
    await RESPOND(
      req("PATCH", "/", { action: "accept" }),
      ctx({ id: AVA_EVENT, collabId: collab.id }),
    );

    // Publishing, and inviting further collaborators, stay with the owner.
    const publish = await parse<Event>(
      await PATCH_EVENT(
        req("PATCH", "/", { status: "published" }),
        ctx({ id: AVA_EVENT }),
      ),
    );
    expect(publish.status).toBe(403);

    const chain = await parse<EventCollaborator>(
      await ADD_COLLAB(
        req("POST", "/", { channel: "phone", label: "۰۹۱۲…" }),
        ctx({ id: AVA_EVENT }),
      ),
    );
    expect(chain.status).toBe(403);
  });

  it("refuses someone the invite was not sent to", async () => {
    const AVA_EVENT = await freshEvent();
    const collab = await invite(AVA_EVENT);
    // A third party must not be able to accept an invite meant for another.
    await signInAs("09188889999");
    const parsed = await parse(
      await RESPOND(
        req("PATCH", "/", { action: "accept" }),
        ctx({ id: AVA_EVENT, collabId: collab.id }),
      ),
    );
    expect(parsed.status).toBe(403);
    expect(errorCode(parsed)).toBe("FORBIDDEN");
  });

  it("declines without granting anything", async () => {
    const AVA_EVENT = await freshEvent();
    const collab = await invite(AVA_EVENT);
    await signInAs(NEGAR_OWNER);
    const declined = data(
      await parse<EventCollaborator>(
        await RESPOND(
          req("PATCH", "/", { action: "decline" }),
          ctx({ id: AVA_EVENT, collabId: collab.id }),
        ),
      ),
    );
    expect(declined.status).toBe("revoked");

    const attempt = await parse<Event>(
      await PATCH_EVENT(
        req("PATCH", "/", { description: "nope" }),
        ctx({ id: AVA_EVENT }),
      ),
    );
    expect(attempt.status).toBe(403);
  });

  it("refuses a second answer", async () => {
    const AVA_EVENT = await freshEvent();
    const collab = await invite(AVA_EVENT);
    await signInAs(NEGAR_OWNER);
    await RESPOND(
      req("PATCH", "/", { action: "accept" }),
      ctx({ id: AVA_EVENT, collabId: collab.id }),
    );

    const again = await parse(
      await RESPOND(
        req("PATCH", "/", { action: "decline" }),
        ctx({ id: AVA_EVENT, collabId: collab.id }),
      ),
    );
    expect(again.status).toBe(409);
  });

  it("404s an unknown invite", async () => {
    const AVA_EVENT = await freshEvent();
    await signInAs(NEGAR_OWNER);
    const parsed = await parse(
      await RESPOND(
        req("PATCH", "/", { action: "accept" }),
        ctx({ id: AVA_EVENT, collabId: "nope" }),
      ),
    );
    expect(parsed.status).toBe(404);
  });
});

describeApi("revoking", () => {
  it("withdraws an accepted collaborator's access", async () => {
    const AVA_EVENT = await freshEvent();
    const collab = await invite(AVA_EVENT);
    await signInAs(NEGAR_OWNER);
    await RESPOND(
      req("PATCH", "/", { action: "accept" }),
      ctx({ id: AVA_EVENT, collabId: collab.id }),
    );

    await signInAs(AVA_OWNER);
    const revoked = data(
      await parse<EventCollaborator>(
        await RESPOND(
          req("PATCH", "/", { action: "revoke" }),
          ctx({ id: AVA_EVENT, collabId: collab.id }),
        ),
      ),
    );
    expect(revoked.status).toBe("revoked");

    // Access goes with it — the row is kept, not the grant.
    await signInAs(NEGAR_OWNER);
    const attempt = await parse<Event>(
      await PATCH_EVENT(req("PATCH", "/", { description: "x" }), ctx({ id: AVA_EVENT })),
    );
    expect(attempt.status).toBe(403);
  });

  it("refuses a co-host trying to revoke", async () => {
    const AVA_EVENT = await freshEvent();
    const collab = await invite(AVA_EVENT);
    await signInAs(NEGAR_OWNER);
    await RESPOND(
      req("PATCH", "/", { action: "accept" }),
      ctx({ id: AVA_EVENT, collabId: collab.id }),
    );

    // A co-host revoking others would be collaborators:manage by another name.
    const parsed = await parse(
      await RESPOND(
        req("PATCH", "/", { action: "revoke" }),
        ctx({ id: AVA_EVENT, collabId: collab.id }),
      ),
    );
    expect(parsed.status).toBe(403);
  });
});

describeApi("GET /api/me/invites", () => {
  it("lists invites awaiting this user, and drops them once answered", async () => {
    const AVA_EVENT = await freshEvent();
    const collab = await invite(AVA_EVENT);

    await signInAs(NEGAR_OWNER);
    const pending = data(await parse<EventCollaborator[]>(await MY_INVITES()));
    expect(pending.map((c) => c.id)).toContain(collab.id);

    await RESPOND(
      req("PATCH", "/", { action: "accept" }),
      ctx({ id: AVA_EVENT, collabId: collab.id }),
    );
    const after = data(await parse<EventCollaborator[]>(await MY_INVITES()));
    expect(after.map((c) => c.id)).not.toContain(collab.id);
  });

  it("refuses an anonymous caller", async () => {
    await signOut();
    expect((await parse(await MY_INVITES())).status).toBe(401);
    await signInAsOwner();
  });
});
