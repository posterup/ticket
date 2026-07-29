import { listAttendeeTags } from "@/lib/server";
import { requireActiveWorkspace } from "@/lib/server/auth/guards";
import { handler, ok } from "@/lib/server/http";

/**
 * GET /api/me/tags — the active workspace's CRM tag labels.
 *
 * What the create wizard offers as audience restrictions; they belong to the
 * workspace the event will be created under.
 */
export const GET = handler(async () => {
  const { workspace } = await requireActiveWorkspace();
  return ok(await listAttendeeTags(workspace.workspaceId));
});
