import { createEvent, listPublicEvents } from "@/lib/server";
import { requireUser, requireWorkspaceAccess, listMemberships } from "@/lib/server/auth/guards";
import { handler, HttpError, ok, readJson } from "@/lib/server/http";
import { createEventSchema } from "@/lib/server/schemas/event";

/**
 * GET /api/events — published, publicly-visible events only.
 *
 * Drafts and link/audience-only events are deliberately absent: this endpoint
 * is unauthenticated. The dashboard reads through `lib/server` instead, scoped
 * to what the viewer manages.
 */
export const GET = handler(async () => ok(await listPublicEvents()));

/** POST /api/events — create an event in a workspace you can write to. */
export const POST = handler(async (request: Request) => {
  const input = await readJson(request, createEventSchema);
  const user = await requireUser();

  // The wizard does not name a workspace, so default to the caller's own.
  // Whichever it is, `requireWorkspaceAccess` still has to allow it.
  const workspaceId =
    input.workspaceId ?? (await listMemberships(user.id))[0]?.workspaceId;
  if (!workspaceId) {
    throw new HttpError(
      403,
      "NOT_A_MANAGER",
      "برای ساخت رویداد ابتدا فضای کاری بسازید.",
    );
  }
  await requireWorkspaceAccess(workspaceId, "event:create");

  return ok(await createEvent({ ...input, workspaceId }), 201);
});
