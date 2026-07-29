import {
  getCurrentUser,
  listMemberships,
  type Membership,
  type SessionUser,
} from "@/lib/server/auth/guards";
import { handler, ok } from "@/lib/server/http";

interface MeResponse {
  user: SessionUser | null;
  memberships: Membership[];
}

/** GET /api/auth/me — the signed-in user and their workspaces, or nulls. */
export const GET = handler(async () => {
  const user = await getCurrentUser();
  const body: MeResponse = user
    ? { user, memberships: await listMemberships(user.id) }
    : { user: null, memberships: [] };

  return ok(body);
});
