import { createTicketType, listTickets } from "@/lib/server";
import { handler, ok, readJson, readQuery } from "@/lib/server/http";
import {
  createTicketTypeSchema,
  listTicketsQuery,
} from "@/lib/server/schemas/ticket";

/** GET /api/tickets — list ticket types, optionally filtered by `?eventId=`. */
export const GET = handler(async (request: Request) => {
  const { eventId } = readQuery(request, listTicketsQuery);
  return ok(await listTickets(eventId));
});

/** POST /api/tickets — create a ticket type. 400 on invalid body, 201 on success. */
export const POST = handler(async (request: Request) => {
  const input = await readJson(request, createTicketTypeSchema);
  return ok(await createTicketType(input), 201);
});
