import { listWorkspaces } from "@/lib/server";
import { createWorkspace } from "@/lib/server/workspaces-create";
import { requireUser } from "@/lib/server/auth/guards";
import { handler, ok, readJson } from "@/lib/server/http";
import { createWorkspaceSchema } from "@/lib/server/schemas/workspace";

/** GET /api/workspaces — the public organizer directory. */
export const GET = handler(async () => ok(await listWorkspaces()));

/**
 * POST /api/workspaces — create one, and become its owner.
 *
 * The route that was missing. `/dashboard/workspaces/new` shipped with a form
 * whose submit handler was `router.push("/dashboard/events")` under a comment
 * reading "Mock create" — so it created nothing, and the navigation landed a
 * person with no workspace on a dashboard that refuses people with no
 * workspace, bouncing them to `/me`. From the outside that is a button that
 * does nothing.
 *
 * `requireUser`, not `requireManager`: owning a workspace is what makes a
 * manager, so demanding one here would lock the only door into being one — the
 * same circularity the dashboard layout had.
 */
export const POST = handler(async (request: Request) => {
  const input = await readJson(request, createWorkspaceSchema);
  const user = await requireUser();

  const workspace = await createWorkspace({
    userId: user.id,
    name: input.name,
    bio: input.bio,
  });

  return ok({ workspace }, 201);
});
