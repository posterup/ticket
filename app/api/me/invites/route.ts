import { listPendingInvites } from "@/lib/server";
import { listMemberships, requireUser } from "@/lib/server/auth/guards";
import { handler, ok } from "@/lib/server/http";

/** GET /api/me/invites — collaboration invites awaiting this user's answer. */
export const GET = handler(async () => {
  const user = await requireUser();
  const memberships = await listMemberships(user.id);

  return ok(
    await listPendingInvites({
      workspaceIds: memberships.map((m) => m.workspaceId),
      phone: user.phone,
    }),
  );
});
