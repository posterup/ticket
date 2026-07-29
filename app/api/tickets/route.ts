import { createTicketType, listTickets } from "@/lib/server";
import { requireEventAccess } from "@/lib/server/auth/guards";
import { handler, HttpError, ok, readJson, readQuery } from "@/lib/server/http";
import {
  createTicketTypeSchema,
  listTicketsQuery,
} from "@/lib/server/schemas/ticket";

/**
 * GET /api/tickets?eventId= — a single event's ticket types.
 *
 * `eventId` is required. Unfiltered, this returned every ticket type in the
 * system — including prices and capacities for unpublished events. Read access
 * to the event is enough, so the public event page still works.
 */
export const GET = handler(async (request: Request) => {
  const { eventId } = readQuery(request, listTicketsQuery);
  if (!eventId) {
    throw new HttpError(400, "INVALID_QUERY", "eventId الزامی است.");
  }
  await requireEventAccess(eventId, "event:read");
  return ok(await listTickets(eventId));
});

/** POST /api/tickets — create a ticket type. 400 on invalid body, 201 on success. */
export const POST = handler(async (request: Request) => {
  const input = await readJson(request, createTicketTypeSchema);
  await requireEventAccess(input.eventId, "tickets:manage");
  return ok(await createTicketType(input), 201);
});
