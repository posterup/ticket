import { setRegistrationStatus } from "@/lib/server";
import { handler, notFound, ok, readJson } from "@/lib/server/http";
import { registrationStatusSchema } from "@/lib/server/schemas/registration";

type Context = { params: Promise<{ registrationId: string }> };

/** PATCH /api/events/:id/registrations/:registrationId — accept/reject a request. */
export const PATCH = handler(async (request: Request, { params }: Context) => {
  const { registrationId } = await params;
  const { status } = await readJson(request, registrationStatusSchema);

  const registration = setRegistrationStatus(registrationId, status);
  if (registration === undefined) throw notFound("Registration not found.");
  return ok(registration);
});
