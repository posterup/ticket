import { updateTicketType } from "@/lib/server";
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

  const ticket = updateTicketType(id, patch);
  if (ticket === undefined) throw notFound("Ticket type was not found.");
  return ok(ticket);
});
