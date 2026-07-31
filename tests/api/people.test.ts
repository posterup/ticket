import { it, expect, beforeAll, afterAll } from "vitest";

import {
  GET as LIST_GUESTS,
  POST as ADD_GUEST,
} from "@/app/api/events/[id]/guests/route";
import {
  PATCH as SET_GUEST,
  DELETE as REMOVE_GUEST,
} from "@/app/api/events/[id]/guests/[guestId]/route";
import {
  GET as LIST_COLLABS,
  POST as ADD_COLLAB,
} from "@/app/api/events/[id]/collaborators/route";
import { DELETE as REMOVE_COLLAB } from "@/app/api/events/[id]/collaborators/[collabId]/route";
import { PATCH as SET_REGISTRATION } from "@/app/api/events/[id]/registrations/[registrationId]/route";
import {
  GET as LIST_REGISTRATIONS,
  POST as CREATE_REGISTRATION,
} from "@/app/api/events/[id]/registrations/route";
import type {
  EventCollaborator,
  EventGuest,
  EventRegistration,
} from "@/types";

import {
  ctx,
  data,
  errorCode,
  parse,
  req,
  describeApi,
  signInAs,
  signInAsOwner,
} from "./helpers";

const SEED_EVENT = "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01";
const SEED_SESSION = "c1000000-0000-4000-8000-000000000001";
const SEED_REGISTRATION = "r1000000-0000-4000-8000-000000000001";
/** The seeded approval-gated event the registration requests belong to. */
const APPROVAL_EVENT = "3f1a6c2e-0010-4a10-9b21-1a2b3c4d5e10";

// These endpoints are organiser-side, so the suite runs as the seeded owner.
beforeAll(async () => {
  if (process.env.DATABASE_URL) await signInAsOwner();
});

describeApi("guests", () => {
  it("lists an event's guests", async () => {
    const guests = data(
      await parse<EventGuest[]>(
        await LIST_GUESTS(req("GET", "/"), ctx({ id: SEED_EVENT })),
      ),
    );
    expect(guests.length).toBeGreaterThan(0);
    expect(guests.every((g) => g.eventId === SEED_EVENT)).toBe(true);
  });

  it("invites a guest as pending", async () => {
    const guest = data(
      await parse<EventGuest>(
        await ADD_GUEST(
          req("POST", "/", {
            sessionId: SEED_SESSION,
            contact: "09120000001",
            channel: "phone",
          }),
          ctx({ id: SEED_EVENT }),
        ),
      ),
    );
    expect(guest.status).toBe("pending");
    expect(guest.contact).toBe("09120000001");
  });

  it("rejects an unknown channel", async () => {
    const parsed = await parse<EventGuest>(
      await ADD_GUEST(
        req("POST", "/", {
          sessionId: SEED_SESSION,
          contact: "09120000001",
          channel: "telegram",
        }),
        ctx({ id: SEED_EVENT }),
      ),
    );
    expect(parsed.status).toBe(400);
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("requires a session and a contact", async () => {
    const parsed = await parse<EventGuest>(
      await ADD_GUEST(
        req("POST", "/", { contact: "  ", channel: "phone" }),
        ctx({ id: SEED_EVENT }),
      ),
    );
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("sets an RSVP, then removes the guest", async () => {
    const guest = data(
      await parse<EventGuest>(
        await ADD_GUEST(
          req("POST", "/", {
            sessionId: SEED_SESSION,
            contact: "09120000002",
            channel: "phone",
          }),
          ctx({ id: SEED_EVENT }),
        ),
      ),
    );

    const updated = data(
      await parse<EventGuest>(
        await SET_GUEST(
          req("PATCH", "/", { status: "going" }),
          ctx({ id: SEED_EVENT, guestId: guest.id }),
        ),
      ),
    );
    expect(updated.status).toBe("going");

    const removed = await parse<{ id: string }>(
      await REMOVE_GUEST(req("DELETE", "/"), ctx({ id: SEED_EVENT, guestId: guest.id })),
    );
    expect(removed.status).toBe(200);
    expect(data(removed).id).toBe(guest.id);

    // Removing twice is a 404, not a silent success.
    const again = await parse<{ id: string }>(
      await REMOVE_GUEST(req("DELETE", "/"), ctx({ id: SEED_EVENT, guestId: guest.id })),
    );
    expect(again.status).toBe(404);
  });

  it("rejects an unknown RSVP status", async () => {
    const parsed = await parse<EventGuest>(
      await SET_GUEST(
        req("PATCH", "/", { status: "maybe" }),
        ctx({ id: SEED_EVENT, guestId: "whatever" }),
      ),
    );
    expect(parsed.status).toBe(400);
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("404s an RSVP for an unknown guest", async () => {
    const parsed = await parse<EventGuest>(
      await SET_GUEST(
        req("PATCH", "/", { status: "going" }),
        ctx({ id: SEED_EVENT, guestId: "nope" }),
      ),
    );
    expect(parsed.status).toBe(404);
  });
});

/**
 * Collaborator invites are added to a *seeded* event, so nothing else removes
 * them: two per run accumulated on that event's collaborator list.
 */
const madeCollaborators: string[] = [];

afterAll(async function dropMadeCollaborators() {
  if (!process.env.DATABASE_URL || !madeCollaborators.length) return;
  const { db } = await import("@/lib/server/db");
  // By id. Filtering on label or workspace cannot work: the seeded
  // collaborator is «استودیو رویداد آوا» on the same event, indistinguishable
  // from the ones these tests add — an earlier attempt deleted it and the seed
  // fixture test caught the damage.
  await db.eventCollaborator.deleteMany({
    where: { id: { in: madeCollaborators } },
  });
  madeCollaborators.length = 0;
});

describeApi("collaborators", () => {
  it("adds a pending request and lists it", async () => {
    const collab = data(
      await parse<EventCollaborator>(
        await ADD_COLLAB(
          req("POST", "/", {
            channel: "workspace",
            label: "استودیو رویداد آوا",
            sub: "@ava-events",
            workspaceSlug: "ava-events",
          }),
          ctx({ id: SEED_EVENT }),
        ),
      ),
    );
    madeCollaborators.push(collab.id);
    expect(collab.status).toBe("pending");
    expect(collab.workspaceSlug).toBe("ava-events");

    const listed = data(
      await parse<EventCollaborator[]>(
        await LIST_COLLABS(req("GET", "/"), ctx({ id: SEED_EVENT })),
      ),
    );
    expect(listed.some((c) => c.id === collab.id)).toBe(true);
  });

  it("defaults a missing sub to an empty string", async () => {
    const collab = data(
      await parse<EventCollaborator>(
        await ADD_COLLAB(
          req("POST", "/", { channel: "phone", label: "همکار" }),
          ctx({ id: SEED_EVENT }),
        ),
      ),
    );
    madeCollaborators.push(collab.id);
    expect(collab.sub).toBe("");
  });

  it("requires a channel and a label", async () => {
    const parsed = await parse<EventCollaborator>(
      await ADD_COLLAB(
        req("POST", "/", { channel: "workspace", label: "   " }),
        ctx({ id: SEED_EVENT }),
      ),
    );
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("removes a request, and 404s the second time", async () => {
    const collab = data(
      await parse<EventCollaborator>(
        await ADD_COLLAB(
          req("POST", "/", { channel: "username", label: "کاربر", sub: "@user" }),
          ctx({ id: SEED_EVENT }),
        ),
      ),
    );
    madeCollaborators.push(collab.id);

    const removed = await parse<{ id: string }>(
      await REMOVE_COLLAB(req("DELETE", "/"), ctx({ id: SEED_EVENT, collabId: collab.id })),
    );
    expect(removed.status).toBe(200);

    const again = await parse<{ id: string }>(
      await REMOVE_COLLAB(req("DELETE", "/"), ctx({ id: SEED_EVENT, collabId: collab.id })),
    );
    expect(again.status).toBe(404);
  });
});

describeApi("registrations", () => {
  // The approval-gated fixture belongs to negar-karimi, not ava-events — so
  // this block runs as its actual owner. The cross-tenant case is asserted at
  // the end of the file.
  beforeAll(async () => {
    if (process.env.DATABASE_URL) await signInAs("09120000002");
  });

  it("lists an event's requests", async () => {
    const listed = data(
      await parse<EventRegistration[]>(
        await LIST_REGISTRATIONS(
          req("GET", "/"),
          ctx({ id: APPROVAL_EVENT }),
        ),
      ),
    );
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.every((r) => r.eventId === APPROVAL_EVENT)).toBe(true);
  });

  it("creates a request, always pending", async () => {
    const parsed = await parse<EventRegistration>(
      await CREATE_REGISTRATION(
        req("POST", "/", {
          name: "سارا محمدی",
          phone: "09121234567",
          tickets: 2,
          // A caller cannot self-approve: status is not part of the schema.
          status: "accepted",
        }),
        ctx({ id: APPROVAL_EVENT }),
      ),
    );
    expect(parsed.status).toBe(201);
    const created = data(parsed);
    expect(created.status).toBe("pending");
    expect(created.tickets).toBe(2);
    expect(created.eventId).toBe(APPROVAL_EVENT);
  });

  it("rejects a malformed phone number", async () => {
    const parsed = await parse<EventRegistration>(
      await CREATE_REGISTRATION(
        req("POST", "/", { name: "سارا", phone: "12345", tickets: 1 }),
        ctx({ id: APPROVAL_EVENT }),
      ),
    );
    expect(parsed.status).toBe(400);
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("rejects a non-positive ticket count", async () => {
    const parsed = await parse<EventRegistration>(
      await CREATE_REGISTRATION(
        req("POST", "/", { name: "سارا", phone: "09121234567", tickets: 0 }),
        ctx({ id: APPROVAL_EVENT }),
      ),
    );
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("404s a request against an unknown event", async () => {
    const parsed = await parse<EventRegistration>(
      await CREATE_REGISTRATION(
        req("POST", "/", { name: "سارا", phone: "09121234567", tickets: 1 }),
        ctx({ id: "nope" }),
      ),
    );
    expect(parsed.status).toBe(404);
    expect(errorCode(parsed)).toBe("NOT_FOUND");
  });

  it("accepts a pending request", async () => {
    const parsed = await parse<EventRegistration>(
      await SET_REGISTRATION(
        req("PATCH", "/", { status: "accepted" }),
        ctx({ id: APPROVAL_EVENT, registrationId: SEED_REGISTRATION }),
      ),
    );
    expect(data(parsed).status).toBe("accepted");
  });

  it("rejects an unknown status", async () => {
    const parsed = await parse<EventRegistration>(
      await SET_REGISTRATION(
        req("PATCH", "/", { status: "maybe" }),
        ctx({ id: APPROVAL_EVENT, registrationId: SEED_REGISTRATION }),
      ),
    );
    expect(parsed.status).toBe(400);
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("404s an unknown registration", async () => {
    const parsed = await parse<EventRegistration>(
      await SET_REGISTRATION(
        req("PATCH", "/", { status: "accepted" }),
        ctx({ id: APPROVAL_EVENT, registrationId: "nope" }),
      ),
    );
    expect(parsed.status).toBe(404);
    expect(errorCode(parsed)).toBe("NOT_FOUND");
  });
});

describeApi("cross-workspace access", () => {
  it("refuses an organiser access to another workspace's event", async () => {
    // ava-events does not own the approval-gated fixture, and holding a
    // workspace of your own must not grant reach into someone else's.
    await signInAsOwner();

    const listed = await parse<EventRegistration[]>(
      await LIST_REGISTRATIONS(req("GET", "/"), ctx({ id: APPROVAL_EVENT })),
    );
    expect(listed.status).toBe(403);
    expect(errorCode(listed)).toBe("FORBIDDEN");

    const decided = await parse<EventRegistration>(
      await SET_REGISTRATION(
        req("PATCH", "/", { status: "accepted" }),
        ctx({ id: APPROVAL_EVENT, registrationId: SEED_REGISTRATION }),
      ),
    );
    expect(decided.status).toBe(403);
  });

  it("refuses an anonymous caller the guest list", async () => {
    const { signOut } = await import("./helpers");
    await signOut();

    const parsed = await parse<EventGuest[]>(
      await LIST_GUESTS(req("GET", "/"), ctx({ id: SEED_EVENT })),
    );
    // Contact details, so anonymous gets 401 rather than an empty list.
    expect(parsed.status).toBe(401);
    expect(errorCode(parsed)).toBe("UNAUTHENTICATED");

    await signInAsOwner();
  });
});
