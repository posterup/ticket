import { handler, ok, readJson } from "@/lib/server/http";
import { requireEventAccess } from "@/lib/server/auth/guards";
import { refundOrder } from "@/lib/server/refunds";
import { db } from "@/lib/server/db";
import { notFound } from "@/lib/server/http";
import { z } from "zod";

type Context = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  reason: z.string().max(280).optional(),
  /** Suppress the buyer SMS — for a bulk pass that has already told them. */
  notify: z.boolean().optional(),
});

/**
 * POST /api/orders/:id/refund — unwind a paid order.
 *
 * Organiser-only, and gated on the *event*, not the order: `order:refund` is
 * not a thing a buyer may do to their own order. A buyer who wants out before
 * the show uses `/cancel`, which only works while the order is still unpaid.
 */
export const POST = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id },
    select: { eventId: true },
  });
  if (!order) throw notFound("سفارش پیدا نشد.");

  await requireEventAccess(order.eventId, "event:edit");

  let body: { reason?: string; notify?: boolean } = {};
  try {
    body = await readJson(request, bodySchema);
  } catch {
    body = {};
  }

  return ok(await refundOrder(id, body));
});
