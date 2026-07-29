import { createRegistration, getEventById, listRegistrations } from "@/lib/server";
import { requireEventAccess } from "@/lib/server/auth/guards";
import { handler, notFound, ok, readJson } from "@/lib/server/http";
import { createRegistrationSchema } from "@/lib/server/schemas/registration";

type Context = { params: Promise<{ id: string }> };

/** GET /api/events/:id/registrations — the event's join requests, newest first. */
export const GET = handler(async (_request: Request, { params }: Context) => {
  const { id } = await params;
  // Names and phone numbers of applicants — organiser-side only.
  await requireEventAccess(id, "registrations:read");
  return ok(await listRegistrations(id));
});

/**
 * POST /api/events/:id/registrations — an attendee asks to join an
 * approval-gated event. The request always lands as `pending`.
 */
export const POST = handler(async (request: Request, { params }: Context) => {
  const { id } = await params;
  const input = await readJson(request, createRegistrationSchema);

  const event = await getEventById(id);
  if (event === undefined) throw notFound(`Event "${id}" was not found.`);

  return ok(await createRegistration(id, input), 201);
});
