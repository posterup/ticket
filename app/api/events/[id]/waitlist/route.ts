import { requireEventAccess } from "@/lib/server/auth/guards";
import { handler, ok, readJson, readQuery } from "@/lib/server/http";
import {
  joinWaitlist,
  leaveWaitlist,
  listWaitlist,
  waitlistPlace,
} from "@/lib/server/waitlist";
import {
  joinWaitlistSchema,
  waitlistLookupSchema,
} from "@/lib/server/schemas/waitlist";

type Context = { params: Promise<{ id: string }> };

/**
 * One endpoint, two audiences — a personal place or the organiser's queue — so
 * the payload type is a union rather than inferred from whichever branch the
 * compiler saw first.
 */
type WaitlistRead =
  | Awaited<ReturnType<typeof waitlistPlace>>
  | null
  | Awaited<ReturnType<typeof listWaitlist>>;

/**
 * GET /api/events/:id/waitlist — the queue, or one person's place in it.
 *
 * With an `x-waitlist-phone` header it is public and returns only that
 * caller's own position: someone who joined as a guest has no session to look
 * themselves up with. Without it, it is the organiser's list and needs
 * `registrations:read` — the queue is names and phone numbers.
 *
 * The phone travels in a **header**, not `?phone=`. A GET has no body, and a
 * query parameter puts the number in the access log, the browser history and
 * the `Referer` sent to any third party the page loads from — for the value
 * that is standing in for a session.
 */
export const GET = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const phone = waitlistLookupSchema.parse({
    phone: request.headers.get("x-waitlist-phone") ?? undefined,
  }).phone;

  if (phone) return ok<WaitlistRead>((await waitlistPlace(id, phone)) ?? null);

  await requireEventAccess(id, "registrations:read");
  return ok<WaitlistRead>(await listWaitlist(id));
});

/** POST /api/events/:id/waitlist — join. Idempotent by phone. */
export const POST = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const input = await readJson(request, joinWaitlistSchema);
  return ok(await joinWaitlist({ eventId: id, ...input }), 201);
});

/** DELETE /api/events/:id/waitlist?phone= — leave. */
export const DELETE = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const { phone } = readQuery(request, waitlistLookupSchema);
  if (!phone) return ok({ left: false });
  return ok(await leaveWaitlist(id, phone));
});
