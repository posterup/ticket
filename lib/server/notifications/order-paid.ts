/**
 * Order confirmation messages.
 *
 * Two audiences, two messages, on the same event: the buyer gets what they
 * bought and how to find it, the organiser gets told a sale happened.
 *
 * **Never throws.** This is called from inside settlement, and an SMS operator
 * having a bad afternoon must not turn a successfully paid order into a 500 —
 * the money has already moved. Failures are logged and swallowed; the tickets
 * exist either way and the order page is the source of truth.
 */

import { db } from "@/lib/server/db";
import { smsGateway, type SendSmsResult } from "@/lib/server/sms";
import { formatSeat } from "@/lib/format";
import { orderPaidBuyerText, orderPaidOrganiserText } from "./messages";

export interface OrderPaidNotice {
  buyer: { attempted: boolean; ok: boolean; error?: string };
  organiser: { attempted: boolean; ok: boolean; error?: string };
}

const QUIET: OrderPaidNotice = {
  buyer: { attempted: false, ok: false },
  organiser: { attempted: false, ok: false },
};

/**
 * Seat labels, when the order has them.
 *
 * Reads the issued tickets rather than the holds — by the time this runs the
 * holds are gone and the tickets are what actually name the seats.
 */
async function seatSummary(orderId: string): Promise<string> {
  const tickets = await db.ticket.findMany({
    where: { orderId, seatId: { not: null } },
    select: {
      seat: {
        select: {
          label: true,
          row: { select: { label: true } },
          section: { select: { name: true } },
        },
      },
    },
  });
  if (!tickets.length) return "";

  const parts = tickets
    .filter((t) => t.seat)
    .map(
      (t) =>
        formatSeat({
          section: t.seat!.section.name,
          row: t.seat!.row.label,
          number: t.seat!.label,
        }),
    );
  return parts.length ? `\nصندلی‌ها: ${parts.join("، ")}` : "";
}

export async function notifyOrderPaid(orderId: string): Promise<OrderPaidNotice> {
  try {
    const gateway = smsGateway();
    if (!gateway.configured) return QUIET;

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        code: true,
        buyerName: true,
        buyerPhone: true,
        total: true,
        event: {
          select: {
            title: true,
            workspace: {
              select: {
                name: true,
                members: {
                  where: { role: { in: ["OWNER", "ADMIN"] } },
                  select: { user: { select: { phone: true } } },
                },
              },
            },
          },
        },
        items: { select: { quantity: true } },
        // The showing this order names, so the confirmation can say when.
        session: { select: { startAt: true } },
      },
    });
    if (!order) return QUIET;

    const count = order.items.reduce((sum, i) => sum + i.quantity, 0);
    const seats = await seatSummary(orderId);

    const buyerText = orderPaidBuyerText({
      eventTitle: order.event.title,
      count,
      total: order.total,
      seats,
      code: order.code,
      startAt: order.session?.startAt.toISOString(),
      appUrl: process.env.APP_URL || undefined,
    });

    const buyerResult = await gateway.sendBulk([order.buyerPhone], buyerText);

    // Owners and admins only. Staff run the door; they do not need a ping per
    // sale, and an SMS bill scales with the guest list.
    const organisers = order.event.workspace.members
      .map((m) => m.user.phone)
      .filter(Boolean);

    let organiserResult: SendSmsResult = { ok: false, sent: 0 };
    if (organisers.length) {
      const organiserText = orderPaidOrganiserText({
        eventTitle: order.event.title,
        count,
        total: order.total,
        buyerName: order.buyerName,
      });
      organiserResult = await gateway.sendBulk(organisers, organiserText);
    }

    return {
      buyer: {
        attempted: true,
        ok: buyerResult.ok,
        error: buyerResult.error,
      },
      organiser: {
        attempted: organisers.length > 0,
        ok: organiserResult.ok,
        error: organiserResult.error,
      },
    };
  } catch (error) {
    // Deliberately swallowed — see the file header.
    console.error("[notify] order-paid failed", orderId, error);
    return QUIET;
  }
}
