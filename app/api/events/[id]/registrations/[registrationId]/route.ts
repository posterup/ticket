import { setRegistrationStatus } from "@/lib/server";
import { requireEventAccess } from "@/lib/server/auth/guards";
import { handler, notFound, ok, readJson } from "@/lib/server/http";
import { registrationStatusSchema } from "@/lib/server/schemas/registration";

type Context = { params: Promise<{ id: string; registrationId: string }> };

/** PATCH /api/events/:id/registrations/:registrationId — accept/reject a request. */
export const PATCH = handler(async (request: Request, { params }: Context) => {
  const { id, registrationId } = await params;
  const { status } = await readJson(request, registrationStatusSchema);
  await requireEventAccess(id, "registrations:decide");

  const registration = await setRegistrationStatus(registrationId, status);
  if (registration === undefined) throw notFound("Registration not found.");
  return ok(registration);
});
