/**
 * Telling the people who asked to be told.
 *
 * Two promises the platform made and did not keep. `NotifySubscription` was
 * write-only — the button stored a row, the toggle read it back, and nothing
 * ever sent anyone anything. And an organiser could accept or reject a request
 * to attend without the person who made it ever finding out.
 *
 * The gateway is stubbed: what matters is *who* would be messaged and *how
 * often*, which is exactly what a real operator cannot tell you.
 */

import { it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";

import {
  describeApi,
  trackVenue,
} from "./helpers";

let eventId = "";
let userId = "";
let registrationId = "";

const sent: { phones: string[]; text: string }[] = [];

vi.mock("@/lib/server/sms", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/sms")>();
  return {
    ...actual,
    smsGateway: () => ({
      provider: "stub",
      configured: true,
      sendBulk: async (phones: string[], text: string) => {
        sent.push({ phones, text });
        return { ok: true, sent: phones.length };
      },
      sendVerify: async () => ({ ok: true, sent: 1 }),
    }),
  };
});

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");

  // Its own draft event: this suite publishes things, and publishing a shared
  // fixture would change what every other suite sees.
  const workspace = await db.workspace.findFirstOrThrow({ select: { id: true } });
  const venue = await db.venue.create({
    data: { name: "سالن آزمون خبر", city: "تهران", address: "-", capacity: 40 },
  });
  trackVenue(venue.id);
  const event = await db.event.create({
    data: {
      workspaceId: workspace.id,
      venueId: venue.id,
      title: "آزمون خبردادن",
      description: "",
      mode: "ONE_TIME",
      status: "DRAFT",
      requiresApproval: true,
      sessions: {
        create: {
          startAt: new Date("2026-12-09T18:00:00.000Z"),
          endAt: new Date("2026-12-09T20:00:00.000Z"),
        },
      },
      /**
       * A tier, because «فروش بلیت آغاز شد» is a claim about one.
       *
       * The fixture had none, which made it a published event with nothing on
       * sale — a state `resolveBuyState` renders as «فروش هنوز شروع نشده».
       * `notifyEventPublished` refuses to announce sales for it, so these
       * cases were asserting a message the product should not send.
       *
       * What they are actually about is the *transition*: fired once on
       * publish, not again on re-save. That is unaffected.
       */
      ticketTypes: {
        create: {
          name: "بلیت آزمون",
          price: 100_000,
          capacity: 50,
          category: "GENERAL",
          salesStartAt: new Date("2026-01-01T00:00:00.000Z"),
          salesEndAt: new Date("2026-12-09T18:00:00.000Z"),
        },
      },
    },
    select: { id: true },
  });
  eventId = event.id;

  userId = (await db.user.findFirstOrThrow({ select: { id: true } })).id;
});

afterEach(async () => {
  sent.length = 0;
  if (!eventId) return;
  const { db } = await import("@/lib/server/db");
  await db.event.update({ where: { id: eventId }, data: { status: "DRAFT" } });
  // Subscriptions are per-test. Leaving one behind makes the next case's
  // "nobody subscribed" quietly false — and the unique constraint on
  // (userId, eventId) makes a second `create` throw.
  await db.notifySubscription.deleteMany({ where: { eventId } });
});

afterAll(async () => {
  if (!eventId) return;
  const { db } = await import("@/lib/server/db");
  await db.notifySubscription.deleteMany({ where: { eventId } });
  await db.eventRegistration.deleteMany({ where: { eventId } });
  await db.eventSession.deleteMany({ where: { eventId } });
  await db.event.deleteMany({ where: { id: eventId } });
  await db.venue.deleteMany({ where: { name: "سالن آزمون خبر" } });
});

const settle = () => new Promise((r) => setTimeout(r, 60));

describeApi("«خبرم کن» subscriptions", () => {
  it("messages subscribers when the event is published", async () => {
    const { db } = await import("@/lib/server/db");
    const { updateEvent } = await import("@/lib/server/events");

    await db.notifySubscription.create({ data: { userId, eventId } });
    await updateEvent(eventId, { status: "published" });
    await settle();

    expect(sent).toHaveLength(1);
    expect(sent[0].phones.length).toBe(1);
    expect(sent[0].text).toContain("فروش بلیت آغاز شد");
  });

  it("does not message again when a published event is re-saved", async () => {
    const { db } = await import("@/lib/server/db");
    const { updateEvent } = await import("@/lib/server/events");

    await db.notifySubscription.create({ data: { userId, eventId } });
    await updateEvent(eventId, { status: "published" });
    await settle();
    expect(sent).toHaveLength(1);

    await updateEvent(eventId, { status: "published" });
    await updateEvent(eventId, { title: "آزمون خبردادن" });
    await settle();

    expect(sent).toHaveLength(1);
  });

  it("says nothing when nobody subscribed", async () => {
    const { updateEvent } = await import("@/lib/server/events");
    await updateEvent(eventId, { status: "published" });
    await settle();
    expect(sent).toHaveLength(0);
  });

  it("stops messaging someone who un-subscribed", async () => {
    const { db } = await import("@/lib/server/db");
    const { setNotify } = await import("@/lib/server/engagement-user");
    const { updateEvent } = await import("@/lib/server/events");

    await setNotify(userId, eventId, true);
    await setNotify(userId, eventId, false);
    await updateEvent(eventId, { status: "published" });
    await settle();

    expect(sent).toHaveLength(0);
    expect(
      await db.notifySubscription.count({ where: { eventId } }),
    ).toBe(0);
  });
});

describeApi("registration decisions", () => {
  it("tells the organiser a request is waiting", async () => {
    const { createRegistration } = await import("@/lib/server/registrations");

    const reg = await createRegistration(eventId, {
      name: "مهمان آزمون",
      phone: "09121114000",
      tickets: 2,
    });
    registrationId = reg.id;
    await settle();

    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain("درخواست تازه");
    expect(sent[0].text).toContain("مهمان آزمون");
  });

  it("tells the guest they were accepted, and how to finish", async () => {
    const { createRegistration, setRegistrationStatus } = await import(
      "@/lib/server/registrations"
    );
    const reg = await createRegistration(eventId, {
      name: "مهمان آزمون",
      phone: "09121114001",
      tickets: 1,
    });
    await settle();
    sent.length = 0;

    await setRegistrationStatus(reg.id, "accepted");
    await settle();

    expect(sent).toHaveLength(1);
    expect(sent[0].phones).toEqual(["09121114001"]);
    expect(sent[0].text).toContain("تأیید شد");
  });

  it("tells the guest when they were not accepted", async () => {
    const { createRegistration, setRegistrationStatus } = await import(
      "@/lib/server/registrations"
    );
    const reg = await createRegistration(eventId, {
      name: "مهمان آزمون",
      phone: "09121114002",
      tickets: 1,
    });
    await settle();
    sent.length = 0;

    await setRegistrationStatus(reg.id, "rejected");
    await settle();

    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain("پذیرفته نشد");
  });

  it("does not tell them twice when the same decision is re-saved", async () => {
    const { createRegistration, setRegistrationStatus } = await import(
      "@/lib/server/registrations"
    );
    const reg = await createRegistration(eventId, {
      name: "مهمان آزمون",
      phone: "09121114003",
      tickets: 1,
    });
    await settle();
    sent.length = 0;

    await setRegistrationStatus(reg.id, "accepted");
    await setRegistrationStatus(reg.id, "accepted");
    await settle();

    expect(sent).toHaveLength(1);
  });

  it("stays quiet when a decision is reset to pending", async () => {
    const { createRegistration, setRegistrationStatus } = await import(
      "@/lib/server/registrations"
    );
    const reg = await createRegistration(eventId, {
      name: "مهمان آزمون",
      phone: "09121114004",
      tickets: 1,
    });
    await setRegistrationStatus(reg.id, "accepted");
    await settle();
    sent.length = 0;

    // An organiser correcting themselves. "Your request is being
    // reconsidered" is not news anyone can act on.
    await setRegistrationStatus(reg.id, "pending");
    await settle();

    expect(sent).toHaveLength(0);
    void registrationId;
  });
});

describeApi("collaboration invites", () => {
  it("texts a phone invitee, who may have no account at all", async () => {
    const { addCollaborator } = await import("@/lib/server/collaborators");

    const invite = await addCollaborator(eventId, {
      channel: "phone",
      label: "همکار تلفنی",
      sub: "09121114500",
      role: "co-host",
    });
    await settle();

    expect(sent).toHaveLength(1);
    expect(sent[0].phones).toEqual(["09121114500"]);
    expect(sent[0].text).toContain("دعوت به همکاری");
    expect(sent[0].text).toContain("میزبان همکار");

    const { db } = await import("@/lib/server/db");
    await db.eventCollaborator.deleteMany({ where: { id: invite.id } });
  });

  it("names the role it is actually offering", async () => {
    const { addCollaborator } = await import("@/lib/server/collaborators");

    const invite = await addCollaborator(eventId, {
      channel: "phone",
      label: "مأمور ورودی",
      sub: "09121114501",
      role: "checkin",
    });
    await settle();

    // «ورودی و پذیرش» grants the door and nothing else; saying "co-host" would
    // misrepresent what is being asked.
    expect(sent[0].text).toContain("ورودی و پذیرش");
    expect(sent[0].text).not.toContain("میزبان همکار");

    const { db } = await import("@/lib/server/db");
    await db.eventCollaborator.deleteMany({ where: { id: invite.id } });
  });

  it("reaches a workspace's owners when the invite names an organisation", async () => {
    const { db } = await import("@/lib/server/db");
    const { addCollaborator } = await import("@/lib/server/collaborators");

    const target = await db.workspace.findFirstOrThrow({
      where: { slug: "negar-karimi" },
      select: { slug: true, members: { select: { user: { select: { phone: true } } } } },
    });

    const invite = await addCollaborator(eventId, {
      channel: "workspace",
      label: "نگار کریمی",
      sub: "@negar-karimi",
      workspaceSlug: target.slug,
    });
    await settle();

    expect(sent).toHaveLength(1);
    // An organisation has no phone; its owners do.
    expect(sent[0].phones).toEqual(
      expect.arrayContaining(target.members.map((m) => m.user.phone)),
    );

    await db.eventCollaborator.deleteMany({ where: { id: invite.id } });
  });

  it("says nothing when a workspace invite names one that does not exist", async () => {
    const { db } = await import("@/lib/server/db");
    const { addCollaborator } = await import("@/lib/server/collaborators");

    const invite = await addCollaborator(eventId, {
      channel: "workspace",
      label: "ناموجود",
      sub: "@nobody",
      workspaceSlug: "no-such-workspace",
    });
    await settle();

    // The invite is still recorded — an organiser may have mistyped a slug and
    // the row is what lets them see and fix it.
    expect(sent).toHaveLength(0);
    await db.eventCollaborator.deleteMany({ where: { id: invite.id } });
  });
});

