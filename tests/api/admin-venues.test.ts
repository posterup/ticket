import { it, expect, beforeAll, afterAll } from "vitest";

import { GET as LIST } from "@/app/api/admin/venues/route";
import { GET as GET_LAYOUT, PATCH as SAVE } from "@/app/api/admin/venues/[venueId]/layout/route";
import { POST as PUBLISH } from "@/app/api/admin/venues/[venueId]/layout/publish/route";
import { GET as SESSION } from "@/app/api/sessions/[id]/route";
import type { LayoutSpec } from "@/types";

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

const THEATRE = "7a2b1c3d-0001-4e5f-9a8b-1c2d3e4f5a01";
let ownerId = "";
let versionsBefore = 0;
/** Publishing moves this pointer; restoring it is part of cleaning up. */
let publishedBefore: string | null = null;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");
  ownerId = await signInAsOwner();
  await db.user.update({ where: { id: ownerId }, data: { platformAdmin: true } });
  versionsBefore = await db.venueLayoutVersion.count();
  publishedBefore =
    (
      await db.venueLayout.findUnique({
        where: { venueId: THEATRE },
        select: { publishedVersionId: true },
      })
    )?.publishedVersionId ?? null;
});

afterAll(async () => {
  if (!process.env.DATABASE_URL || !ownerId) return;
  const { db } = await import("@/lib/server/db");
  // Drop only the versions this suite published, newest first.
  const extra = await db.venueLayoutVersion.findMany({
    orderBy: { publishedAt: "desc" },
    take: Math.max(0, (await db.venueLayoutVersion.count()) - versionsBefore),
    select: { id: true },
  });
  if (extra.length) {
    // Point the layout back at its original version *first*: deleting the one
    // it currently names would otherwise leave a dangling id, and the venue
    // would report itself as having no published map at all.
    await db.venueLayout.update({
      where: { venueId: THEATRE },
      data: { publishedVersionId: publishedBefore },
    });
    await db.venueLayoutVersion.deleteMany({
      where: { id: { in: extra.map((v) => v.id) } },
    });
  }
  await signOut();
});

interface LayoutDetail {
  venueId: string;
  draft: LayoutSpec;
  versions: { id: string; version: number }[];
}

describeApi("admin venue designer", () => {
  it("is staff-only at every entry point", async () => {
    await signOut();
    for (const call of [
      () => LIST(),
      () => GET_LAYOUT(req("GET", "/"), ctx({ venueId: THEATRE })),
      () => PUBLISH(req("POST", "/"), ctx({ venueId: THEATRE })),
    ]) {
      expect(errorCode(await parse(await call()))).toBe("UNAUTHENTICATED");
    }
    await signInAsOwner();
  });

  it("returns the editable draft", async () => {
    const layout = data(
      await parse<LayoutDetail>(
        await GET_LAYOUT(req("GET", "/"), ctx({ venueId: THEATRE })),
      ),
    );
    expect(layout.venueId).toBe(THEATRE);
    expect(layout.draft.sections.length).toBeGreaterThan(0);
  });

  it("saves a draft without touching what is on sale", async () => {
    const { db } = await import("@/lib/server/db");
    const before = await db.venueLayout.findUnique({
      where: { venueId: THEATRE },
      select: { publishedVersionId: true },
    });

    const layout = data(
      await parse<LayoutDetail>(
        await GET_LAYOUT(req("GET", "/"), ctx({ venueId: THEATRE })),
      ),
    );
    // A fixed name, not `${s.name} + suffix`: appending grew the stored name
    // on every run until it breached the schema's 80-character cap, so the
    // suite failed for reasons that had nothing to do with the code.
    const original = layout.draft.sections[0]?.name;
    const renamed: LayoutSpec = {
      ...layout.draft,
      sections: layout.draft.sections.map((s, i) =>
        i === 0 ? { ...s, name: "بخش ویرایش‌شده در آزمون" } : s,
      ),
    };
    const saved = await parse(
      await SAVE(req("PATCH", "/", { draft: renamed }), ctx({ venueId: THEATRE })),
    );
    expect(saved.status).toBe(200);

    // Saving is not publishing: the live version must not move.
    const after = await db.venueLayout.findUnique({
      where: { venueId: THEATRE },
      select: { publishedVersionId: true },
    });
    expect(after?.publishedVersionId).toBe(before?.publishedVersionId);

    // Put the name back, so the fixture reads the same before and after.
    if (original) {
      await SAVE(
        req("PATCH", "/", {
          draft: {
            ...layout.draft,
            sections: layout.draft.sections.map((s, i) =>
              i === 0 ? { ...s, name: original } : s,
            ),
          },
        }),
        ctx({ venueId: THEATRE }),
      );
    }
  });

  it("rejects a draft that would not compile", async () => {
    const parsed = await parse(
      await SAVE(
        req("PATCH", "/", { draft: { version: 1, bounds: { width: 0, height: 0 }, sections: [] } }),
        ctx({ venueId: THEATRE }),
      ),
    );
    expect(parsed.status).toBe(400);
  });

  it("publishing mints a new version and leaves older ones intact", async () => {
    const { db } = await import("@/lib/server/db");
    const before = data(
      await parse<LayoutDetail>(
        await GET_LAYOUT(req("GET", "/"), ctx({ venueId: THEATRE })),
      ),
    );
    const previous = before.versions.map((v) => v.id);

    const result = data(
      await parse<{ version: number; totalSeats: number }>(
        await PUBLISH(req("POST", "/"), ctx({ venueId: THEATRE })),
      ),
    );
    expect(result.version).toBe(before.versions.length + 1);
    expect(result.totalSeats).toBeGreaterThan(0);

    // The renovation guarantee: nothing already published is rewritten.
    const survivors = await db.venueLayoutVersion.count({
      where: { id: { in: previous } },
    });
    expect(survivors).toBe(previous.length);
  });
});

describeApi("GET /api/sessions/:id", () => {
  it("reports whether a showing sells assigned seats", async () => {
    const { db } = await import("@/lib/server/db");
    const mapped = await db.eventSession.findFirst({
      where: { layoutVersionId: { not: null } },
      select: { id: true },
    });
    if (!mapped) return;

    const info = data(
      await parse<{ layoutVersionId?: string; venueName?: string }>(
        await SESSION(req("GET", "/"), ctx({ id: mapped.id })),
      ),
    );
    expect(info.layoutVersionId).toBeTruthy();
    expect(info.venueName).toBeTruthy();
  });

  it("404s an unknown session", async () => {
    expect(
      errorCode(await parse(await SESSION(req("GET", "/"), ctx({ id: "nope" })))),
    ).toBe("NOT_FOUND");
  });
});
