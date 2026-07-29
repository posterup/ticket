import { getViewerState, setNotify } from "@/lib/server";
import { requireUser } from "@/lib/server/auth/guards";
import { handler, notFound, ok } from "@/lib/server/http";

type Context = { params: Promise<{ id: string }> };

async function toggle(eventId: string, wanted: boolean) {
  const user = await requireUser();
  if (!(await setNotify(user.id, eventId, wanted))) {
    throw notFound("رویداد یافت نشد.");
  }
  return ok(await getViewerState(user.id, eventId));
}

/** POST /api/events/:id/notify — ask to be told. Idempotent. */
export const POST = handler(async (_r: Request, { params }: Context) =>
  toggle((await params).id, true),
);

/** DELETE /api/events/:id/notify — stop asking. Idempotent. */
export const DELETE = handler(async (_r: Request, { params }: Context) =>
  toggle((await params).id, false),
);
