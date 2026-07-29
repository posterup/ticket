import { requireUser } from "@/lib/server/auth/guards";
import { createWorkspace } from "@/lib/server/workspaces-create";
import { db } from "@/lib/server/db";
import { handler, ok, readJson } from "@/lib/server/http";
import { registerSchema } from "@/lib/server/schemas/auth";

/**
 * POST /api/auth/register — become an organizer.
 *
 * Identity already exists by this point: verifying a code created the user and
 * the session. This is the second, separate step that creates a workspace and
 * makes the caller its owner — the same call `/dashboard/workspaces/new` uses,
 * so a normal user becoming a manager needs no role flip anywhere.
 */
export const POST = handler(async (request: Request) => {
  const input = await readJson(request, registerSchema);
  const user = await requireUser();

  if (input.fullName !== user.fullName) {
    await db.user.update({
      where: { id: user.id },
      data: { fullName: input.fullName },
    });
  }

  const workspace = await createWorkspace({
    userId: user.id,
    name: input.workspaceName,
    type: input.workspaceType,
  });

  return ok({ workspace }, 201);
});
