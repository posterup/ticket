import { updateTicketType } from "@/lib/server";
import { requireEventAccess } from "@/lib/server/auth/guards";
import { db } from "@/lib/server/db";
import { handler, notFound, ok, readJson } from "@/lib/server/http";
import { ticketTypeUpdateSchema } from "@/lib/server/schemas/ticket";

type Context = { params: Promise<{ id: string }> };

/**
 * PATCH /api/tickets/:id — edit a ticket type (name, price, capacity, sales
 * window, category, description). Any subset of fields may be sent.
 */
export const PATCH = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const patch = await readJson(request, ticketTypeUpdateSchema);

  // Permission lives on the owning event, so resolve it before deciding.
  const owner = await db.ticketType.findUnique({
    where: { id },
    select: { eventId: true },
  });
  if (!owner) throw notFound("Ticket type was not found.");
  await requireEventAccess(owner.eventId, "tickets:manage");

  const ticket = await updateTicketType(id, patch);
  if (ticket === undefined) throw notFound("Ticket type was not found.");
  return ok(ticket);
});
