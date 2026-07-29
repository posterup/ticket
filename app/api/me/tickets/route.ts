import { listTicketsByUser } from "@/lib/server";
import { requireUser } from "@/lib/server/auth/guards";
import { handler, ok } from "@/lib/server/http";

/**
 * GET /api/me/tickets — the buyer's issued tickets, with their QR tokens.
 *
 * Only from paid orders, so an abandoned checkout never shows a ticket.
 */
export const GET = handler(async () => {
  const user = await requireUser();
  return ok(await listTicketsByUser(user.id));
});
