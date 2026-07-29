import { setFollowing } from "@/lib/server";
import { requireUser } from "@/lib/server/auth/guards";
import { handler, notFound, ok } from "@/lib/server/http";

type Context = { params: Promise<{ slug: string }> };

async function toggle(slug: string, following: boolean) {
  const user = await requireUser();
  const result = await setFollowing(user.id, slug, following);
  if (!result) throw notFound("فضای کاری یافت نشد.");
  return ok(result);
}

/** POST /api/workspaces/:slug/follow — follow. Idempotent. */
export const POST = handler(async (_r: Request, { params }: Context) =>
  toggle((await params).slug, true),
);

/** DELETE /api/workspaces/:slug/follow — unfollow. Idempotent. */
export const DELETE = handler(async (_r: Request, { params }: Context) =>
  toggle((await params).slug, false),
);
