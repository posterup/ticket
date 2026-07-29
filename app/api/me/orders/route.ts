import { listOrdersByUser } from "@/lib/server";
import { requireUser } from "@/lib/server/auth/guards";
import { handler, ok } from "@/lib/server/http";

/** GET /api/me/orders — the signed-in buyer's own orders, newest first. */
export const GET = handler(async () => {
  const user = await requireUser();
  return ok(await listOrdersByUser(user.id));
});
