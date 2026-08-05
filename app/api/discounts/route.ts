import { createDiscount, listDiscounts } from "@/lib/server";
import { discountCodeExists } from "@/lib/server/discounts";
import {
  requireActiveWorkspace,
  requireEventAccess,
} from "@/lib/server/auth/guards";
import { handler, HttpError, ok, readJson, readQuery } from "@/lib/server/http";
import {
  createDiscountSchema,
  listDiscountsQuery,
} from "@/lib/server/schemas/discount";

/**
 * GET /api/discounts — list codes for an event you manage.
 *
 * `eventId` is required: without it this would hand every code in the system
 * to any caller, which is precisely what it used to do.
 */
export const GET = handler(async (request: Request) => {
  const { eventId } = readQuery(request, listDiscountsQuery);
  if (!eventId) {
    throw new HttpError(400, "INVALID_QUERY", "eventId الزامی است.");
  }
  const { grant } = await requireEventAccess(eventId, "discounts:manage");
  // Scoped to the event's own workspace: this used to include every org-wide
  // code on the platform, rival workspaces included.
  return ok(await listDiscounts(grant.workspaceId, eventId));
});

/** POST /api/discounts — create a discount code. 409 when the code is taken. */
export const POST = handler(async (request: Request) => {
  // The schema has already trimmed and upper-cased `code`.
  const input = await readJson(request, createDiscountSchema);

  let workspaceId: string;
  if (input.eventId) {
    const { grant } = await requireEventAccess(input.eventId, "discounts:manage");
    workspaceId = grant.workspaceId;
  } else {
    // An org-wide code applies to every event of the workspace, so the
    // caller's *own* workspace owns it. It used to be assigned to whichever
    // workspace existed first, which is neither theirs nor useful to them.
    const { workspace } = await requireActiveWorkspace();
    workspaceId = workspace.workspaceId;
  }

  // Uniqueness is per workspace, so this must be too: checking every code on
  // the platform let one organiser block a name another wanted, and leaked
  // that the name was in use somewhere.
  if (await discountCodeExists(workspaceId, input.code)) {
    throw new HttpError(409, "DUPLICATE", "این کد قبلاً ثبت شده است.");
  }

  return ok(await createDiscount(input, workspaceId), 201);
});
