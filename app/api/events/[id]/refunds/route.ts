import { handler, ok, readQuery } from "@/lib/server/http";
import { requireEventAccess } from "@/lib/server/auth/guards";
import { refundQueue } from "@/lib/server/refunds";
import { cancellationReach } from "@/lib/server/notifications/show-cancelled";
import { z } from "zod";

type Context = { params: Promise<{ id: string }> };

const querySchema = z.object({ sessionId: z.string().optional() });

/**
 * GET /api/events/:id/refunds — who is still owed money, and how many people
 * that is.
 *
 * Both in one response because they answer the same question at two moments:
 * `reach` is what an organiser is shown *before* they cancel a showing ("this
 * will text 214 people"), and `orders` is the worklist they are left with
 * *after*. Splitting them would mean two round trips for one decision.
 *
 * Scoped to a سانس when one is given, which is what a cancelled showing needs;
 * the whole event otherwise.
 */
export const GET = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;
  await requireEventAccess(id, "event:edit");
  const { sessionId } = await readQuery(request, querySchema);

  const [orders, reach] = await Promise.all([
    refundQueue(id, sessionId),
    cancellationReach(id, sessionId),
  ]);
  return ok({ orders, reach });
});
