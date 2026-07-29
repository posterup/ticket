import { createEvent, listEvents } from "@/lib/server";
import { handler, ok, readJson } from "@/lib/server/http";
import { createEventSchema } from "@/lib/server/schemas/event";

/** GET /api/events — list all events. */
export const GET = handler(async () => ok(await listEvents()));

/** POST /api/events — create an event. 400 on invalid body, 201 on success. */
export const POST = handler(async (request: Request) => {
  const input = await readJson(request, createEventSchema);
  return ok(await createEvent(input), 201);
});
