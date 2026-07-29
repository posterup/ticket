import { listWorkspaces } from "@/lib/server";
import { handler, ok } from "@/lib/server/http";

/** GET /api/workspaces — the public organizer directory. */
export const GET = handler(async () => ok(await listWorkspaces()));
