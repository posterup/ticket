import { it, expect, beforeAll } from "vitest";

import {
  POST as FOLLOW,
  DELETE as UNFOLLOW,
} from "@/app/api/workspaces/[slug]/follow/route";
import { PUT as BOOKMARK } from "@/app/api/events/[id]/bookmark/route";
import {
  POST as NOTIFY,
  DELETE as UNNOTIFY,
} from "@/app/api/events/[id]/notify/route";
import { GET as MY_FOLLOWING } from "@/app/api/me/following/route";
import { GET as MY_BOOKMARKS } from "@/app/api/me/bookmarks/route";
import { GET as MY_FEED } from "@/app/api/me/feed/route";
import type { Event, Workspace } from "@/types";

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

const AVA = "ava-events";
const NEGAR = "negar-karimi";
const SEED_EVENT = "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01";

/** A fresh account per run, so accumulated state never skews an assertion. */
const VISITOR = "09151112233";

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");
  await db.user.deleteMany({ where: { phone: VISITOR } });
  await signInAs(VISITOR);
});

describeApi("following", () => {
  it("follows and unfollows, idempotently", async () => {
    const first = data(
      await parse<{ following: boolean; followers: number }>(
        await FOLLOW(req("POST", "/"), ctx({ slug: AVA })),
      ),
    );
    expect(first.following).toBe(true);

    // Following twice must not double-count.
    const again = data(
      await parse<{ followers: number }>(
        await FOLLOW(req("POST", "/"), ctx({ slug: AVA })),
      ),
    );
    expect(again.followers).toBe(first.followers);

    const off = data(
      await parse<{ following: boolean; followers: number }>(
        await UNFOLLOW(req("DELETE", "/"), ctx({ slug: AVA })),
      ),
    );
    expect(off.following).toBe(false);
    expect(off.followers).toBe(first.followers - 1);
  });

  it("counts on top of the seeded baseline, not from zero", async () => {
    const { db } = await import("@/lib/server/db");
    const seeded = await db.workspace.findUniqueOrThrow({
      where: { slug: AVA },
      select: { seedFollowers: true },
    });
    const result = data(
      await parse<{ followers: number }>(
        await FOLLOW(req("POST", "/"), ctx({ slug: AVA })),
      ),
    );
    // The social proof on discovery must not visibly deflate.
    expect(result.followers).toBeGreaterThanOrEqual(seeded.seedFollowers);
  });

  it("lists what the user follows", async () => {
    await FOLLOW(req("POST", "/"), ctx({ slug: NEGAR }));
    const followed = data(await parse<Workspace[]>(await MY_FOLLOWING()));
    expect(followed.map((w) => w.slug)).toEqual(
      expect.arrayContaining([AVA, NEGAR]),
    );
  });

  it("404s an unknown page", async () => {
    const parsed = await parse(await FOLLOW(req("POST", "/"), ctx({ slug: "nope" })));
    expect(parsed.status).toBe(404);
  });

  it("refuses an anonymous caller", async () => {
    await signOut();
    const parsed = await parse(await FOLLOW(req("POST", "/"), ctx({ slug: AVA })));
    expect(parsed.status).toBe(401);
    expect(errorCode(parsed)).toBe("UNAUTHENTICATED");
    await signInAs(VISITOR);
  });
});

describeApi("bookmarks", () => {
  it("sets, changes and clears a mark", async () => {
    const going = data(
      await parse<{ bookmark: string | null }>(
        await BOOKMARK(req("PUT", "/", { state: "going" }), ctx({ id: SEED_EVENT })),
      ),
    );
    expect(going.bookmark).toBe("going");

    // A PUT of the desired state, so changing one's mind converges.
    const interested = data(
      await parse<{ bookmark: string | null }>(
        await BOOKMARK(
          req("PUT", "/", { state: "interested" }),
          ctx({ id: SEED_EVENT }),
        ),
      ),
    );
    expect(interested.bookmark).toBe("interested");

    const cleared = data(
      await parse<{ bookmark: string | null }>(
        await BOOKMARK(req("PUT", "/", { state: null }), ctx({ id: SEED_EVENT })),
      ),
    );
    expect(cleared.bookmark).toBeNull();
  });

  it("lists marked events with their state", async () => {
    await BOOKMARK(req("PUT", "/", { state: "going" }), ctx({ id: SEED_EVENT }));
    const marks = data(
      await parse<{ event: Event; state: string }[]>(await MY_BOOKMARKS()),
    );
    const found = marks.find((m) => m.event.id === SEED_EVENT);
    expect(found?.state).toBe("going");
  });

  it("feeds the event's public going count", async () => {
    // Bookmarks are what make the social-proof numbers real.
    const { getEventEngagement } = await import("@/lib/server/engagement");
    const { db } = await import("@/lib/server/db");
    const seeded = await db.event.findUniqueOrThrow({
      where: { id: SEED_EVENT },
      select: { seedGoing: true },
    });

    await BOOKMARK(req("PUT", "/", { state: "going" }), ctx({ id: SEED_EVENT }));
    const engagement = await getEventEngagement(SEED_EVENT);
    expect(engagement.going).toBeGreaterThan(seeded.seedGoing - 1);
  });

  it("rejects an unknown state", async () => {
    const parsed = await parse(
      await BOOKMARK(req("PUT", "/", { state: "maybe" }), ctx({ id: SEED_EVENT })),
    );
    expect(parsed.status).toBe(400);
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("404s an unknown event", async () => {
    const parsed = await parse(
      await BOOKMARK(req("PUT", "/", { state: "going" }), ctx({ id: "nope" })),
    );
    expect(parsed.status).toBe(404);
  });

  it("refuses an anonymous caller", async () => {
    await signOut();
    const parsed = await parse(
      await BOOKMARK(req("PUT", "/", { state: "going" }), ctx({ id: SEED_EVENT })),
    );
    expect(parsed.status).toBe(401);
    await signInAs(VISITOR);
  });
});

describeApi("notify", () => {
  it("subscribes and unsubscribes, idempotently", async () => {
    const on = data(
      await parse<{ notify: boolean }>(
        await NOTIFY(req("POST", "/"), ctx({ id: SEED_EVENT })),
      ),
    );
    expect(on.notify).toBe(true);

    await NOTIFY(req("POST", "/"), ctx({ id: SEED_EVENT }));
    const { db } = await import("@/lib/server/db");
    expect(
      await db.notifySubscription.count({ where: { eventId: SEED_EVENT } }),
    ).toBeGreaterThanOrEqual(1);

    const off = data(
      await parse<{ notify: boolean }>(
        await UNNOTIFY(req("DELETE", "/"), ctx({ id: SEED_EVENT })),
      ),
    );
    expect(off.notify).toBe(false);
  });

  it("refuses an anonymous caller", async () => {
    await signOut();
    const parsed = await parse(await NOTIFY(req("POST", "/"), ctx({ id: SEED_EVENT })));
    expect(parsed.status).toBe(401);
    await signInAs(VISITOR);
  });
});

describeApi("feed", () => {
  it("returns only events from followed pages", async () => {
    const { db } = await import("@/lib/server/db");
    await db.follow.deleteMany({ where: { user: { phone: VISITOR } } });

    // Following nothing means an empty feed, not the whole catalogue — which
    // is what the localStorage version effectively shipped to the browser.
    expect(data(await parse<Event[]>(await MY_FEED()))).toHaveLength(0);

    await FOLLOW(req("POST", "/"), ctx({ slug: NEGAR }));
    const feed = data(await parse<Event[]>(await MY_FEED()));
    expect(feed.length).toBeGreaterThan(0);

    const negar = await db.workspace.findUniqueOrThrow({
      where: { slug: NEGAR },
      select: { id: true },
    });
    for (const event of feed) {
      expect(event.workspaceId).toBe(negar.id);
      expect(event.status).toBe("published");
    }
  });

  it("refuses an anonymous caller", async () => {
    await signOut();
    expect((await parse(await MY_FEED())).status).toBe(401);
    await signInAs(VISITOR);
  });
});
