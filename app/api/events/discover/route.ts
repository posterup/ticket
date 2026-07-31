import {
  getEventEngagements,
  getWorkspacesByEvents,
  listPublicEvents,
  minPriceByEvent,
} from "@/lib/server";
import { getCurrentUser } from "@/lib/server/auth/guards";
import { handler, ok } from "@/lib/server/http";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { modeLabel } from "@/lib/events/labels";

/** "from X Toman", or free, or null when nothing is on sale. */
function fromPrice(min: number | undefined): string | null {
  if (min === undefined) return null;
  return min === 0 ? "رایگان" : `از ${formatToman(min)}`;
}

/**
 * GET /api/events/discover — the shape discovery surfaces render.
 *
 * Prices, organisers and going-counts are joined here rather than left to the
 * client: each is a separate query, and doing them per card in the browser is
 * one request per event.
 *
 * Labels are formatted server-side so the landing strip and the explorer
 * cannot drift apart on how a date or price reads.
 */
export const GET = handler(async () => {
  // Anonymous callers get the public list; a signed-in one also sees events
  // aimed at a CRM segment they are in.
  const viewer = await getCurrentUser();
  const events = await listPublicEvents(
    viewer ? { id: viewer.id, phone: viewer.phone } : undefined,
  );
  const ids = events.map((e) => e.id);

  const [prices, orgs, engagement] = await Promise.all([
    minPriceByEvent(ids),
    getWorkspacesByEvents(ids),
    getEventEngagements(ids),
  ]);

  const rows = events.map((event) => {
    const org = orgs.get(event.id);
    const first = event.sessions[0];
    return {
      id: event.id,
      title: event.title,
      modeLabel: modeLabel(event.mode),
      city: event.venue.city,
      venueName: event.venue.name,
      dateLabel: first ? formatJalaliDate(first.startAt) : "",
      sortKey: first?.startAt ?? "",
      price: fromPrice(prices.get(event.id)),
      going: engagement.get(event.id)?.going ?? 0,
      tags: event.tags,
      categories: event.categories ?? [],
      org: org
        ? {
            slug: org.slug,
            name: org.name,
            avatar: org.avatar,
            verified: Boolean(org.verified),
          }
        : null,
    };
  });

  // Soonest first, as every discovery surface shows them.
  rows.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
  return ok(rows);
});
