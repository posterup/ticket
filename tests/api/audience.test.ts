import { it, expect, beforeAll, afterAll } from "vitest";

import { GET } from "@/app/api/events/[id]/route";
import { GET as DISCOVER } from "@/app/api/events/discover/route";
import type { Event } from "@/types";

import {
  ctx,
  data,
  describeApi,
  errorCode,
  parse,
  req,
  signInAs,
  signOut,
} from "./helpers";

const TARGETED = "09121110001";
const UNTAGGED = "09121110002";
const OUTSIDER = "09121110003";
const TAG = "هواداران ویژه";

let eventId = "";
let workspaceId = "";
let tagId = "";
const madeAttendees: string[] = [];

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");

  const base = await db.event.findFirst({
    where: { status: "PUBLISHED" },
    select: { workspaceId: true, venueId: true },
  });
  if (!base) return;
  workspaceId = base.workspaceId;

  const tag = await db.attendeeTag.upsert({
    where: { workspaceId_label: { workspaceId, label: TAG } },
    create: { workspaceId, label: TAG },
    update: {},
    select: { id: true },
  });
  tagId = tag.id;

  // One contact carrying the tag, one in the same CRM without it.
  for (const [phone, tagged] of [[TARGETED, true], [UNTAGGED, false]] as const) {
    const a = await db.attendee.upsert({
      where: { workspaceId_phone: { workspaceId, phone } },
      create: {
        workspaceId,
        fullName: `مخاطب ${phone}`,
        phone,
        ...(tagged ? { tags: { create: { tagId } } } : {}),
      },
      update: {},
      select: { id: true },
    });
    madeAttendees.push(a.id);
  }

  const created = await db.event.create({
    data: {
      workspaceId,
      venueId: base.venueId,
      title: "رویداد مخاطب هدف",
      description: "-",
      status: "PUBLISHED",
      mode: "ONE_TIME",
      visibility: "AUDIENCE",
      audienceTags: [TAG],
    },
    select: { id: true },
  });
  eventId = created.id;
});

afterAll(async () => {
  if (!process.env.DATABASE_URL || !eventId) return;
  const { db } = await import("@/lib/server/db");
  await db.event.deleteMany({ where: { id: eventId } });
  await db.attendee.deleteMany({ where: { id: { in: madeAttendees } } });
  await db.attendeeTag.deleteMany({ where: { id: tagId } });
  await signOut();
});

const read = async () =>
  parse<Event>(await GET(req("GET", "/"), ctx({ id: eventId })));

describeApi("audience-targeted visibility", () => {
  it("stays closed to anonymous visitors", async () => {
    await signOut();
    expect(errorCode(await read())).toBe("UNAUTHENTICATED");
  });

  it("opens to a signed-in viewer carrying one of the tags", async () => {
    // The whole point: the tag list used to be stored and never read, so this
    // returned 401 for everyone outside the workspace.
    await signInAs(TARGETED);
    const parsed = await read();
    expect(parsed.status).toBe(200);
  });

  it("stays closed to someone in the CRM without the tag", async () => {
    await signInAs(UNTAGGED);
    expect(["UNAUTHENTICATED", "FORBIDDEN"]).toContain(errorCode(await read()));
  });

  it("stays closed to someone who is not in the CRM at all", async () => {
    await signInAs(OUTSIDER);
    expect(["UNAUTHENTICATED", "FORBIDDEN"]).toContain(errorCode(await read()));
  });

  it("fails closed when the organiser targeted no tags", async () => {
    // "Audience, targeting nothing" is a misconfiguration; reading it as
    // "everyone" is the one mistake with real consequences.
    const { db } = await import("@/lib/server/db");
    await db.event.update({ where: { id: eventId }, data: { audienceTags: [] } });

    await signInAs(TARGETED);
    expect(["UNAUTHENTICATED", "FORBIDDEN"]).toContain(errorCode(await read()));

    await db.event.update({ where: { id: eventId }, data: { audienceTags: [TAG] } });
  });

  it("surfaces the event in discovery for a targeted viewer", async () => {
    // Without this, targeting only reaches someone who was already sent a
    // link — which is not targeting.
    await signInAs(TARGETED);
    const mine = await parse<{ id: string }[]>(await DISCOVER());
    expect(data(mine).some((e) => e.id === eventId)).toBe(true);
  });

  it("keeps it out of discovery for everyone else", async () => {
    await signOut();
    const anon = await parse<{ id: string }[]>(await DISCOVER());
    expect(data(anon).some((e) => e.id === eventId)).toBe(false);

    await signInAs(UNTAGGED);
    const untagged = await parse<{ id: string }[]>(await DISCOVER());
    expect(data(untagged).some((e) => e.id === eventId)).toBe(false);
  });

  it("does not leak across workspaces", async () => {
    // The same tag label in another workspace must not grant access here.
    const { db } = await import("@/lib/server/db");
    const other = await db.workspace.findFirst({
      where: { id: { not: workspaceId } },
      select: { id: true },
    });
    if (!other) return;

    const otherTag = await db.attendeeTag.upsert({
      where: { workspaceId_label: { workspaceId: other.id, label: TAG } },
      create: { workspaceId: other.id, label: TAG },
      update: {},
      select: { id: true },
    });
    const stranger = await db.attendee.upsert({
      where: { workspaceId_phone: { workspaceId: other.id, phone: OUTSIDER } },
      create: {
        workspaceId: other.id,
        fullName: "غریبه",
        phone: OUTSIDER,
        tags: { create: { tagId: otherTag.id } },
      },
      update: {},
      select: { id: true },
    });

    await signInAs(OUTSIDER);
    expect(["UNAUTHENTICATED", "FORBIDDEN"]).toContain(errorCode(await read()));

    await db.attendee.deleteMany({ where: { id: stranger.id } });
    await db.attendeeTag.deleteMany({ where: { id: otherTag.id } });
  });
});
