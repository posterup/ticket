/**
 * Discount-code data-access over Postgres. The redemption rules themselves
 * live in `./rules` and stay datastore-free.
 */

import type {
  CreateDiscountInput,
  DiscountCode,
  DiscountValidation,
  Money,
} from "@/types";

import { db } from "../db";
import { toDiscount } from "../mappers";
import { DISCOUNT_KIND_TO_DB } from "../mappers/enums";
import { checkDiscountEligibility, normalizeCode } from "./rules";

export { computeDiscountAmount, normalizeCode } from "./rules";

/**
 * Discount codes belonging to `workspaceId`, optionally narrowed to one event
 * (plus that workspace's org-wide codes).
 *
 * The workspace is required. Without it this returned every org-wide code on
 * the platform: an organiser opening their own event's discounts was shown
 * rival workspaces' code strings, values and redemption counts — verified with
 * a 70%-off code planted in another workspace and read straight back.
 */
export async function listDiscounts(
  workspaceId: string,
  eventId?: string,
): Promise<DiscountCode[]> {
  const rows = await db.discountCode.findMany({
    where: {
      workspaceId,
      ...(eventId ? { OR: [{ eventId: null }, { eventId }] } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toDiscount);
}

/** Whether `code` is already taken *in this workspace*. Uniqueness is per workspace. */
export async function discountCodeExists(
  workspaceId: string,
  code: string,
): Promise<boolean> {
  const row = await db.discountCode.findFirst({
    where: { workspaceId, code: normalizeCode(code) },
    select: { id: true },
  });
  return row !== null;
}

/**
 * The workspace a code belongs to.
 *
 * An event-scoped code belongs to that event's owner. Anything else belongs to
 * the caller — which is what `workspaceId` is for. This used to fall back to
 * "whichever workspace was created first", and its own comment said ownership
 * would come from the session "once auth lands". Auth has landed: the route
 * guards with `requireManager`, so the caller's workspace is knowable and an
 * org-wide code was being handed to a stranger.
 */
async function resolveWorkspaceId(
  eventId: string | null,
  workspaceId: string,
): Promise<string> {
  if (eventId) {
    const event = await db.event.findUnique({
      where: { id: eventId },
      select: { workspaceId: true },
    });
    if (event) return event.workspaceId;
  }
  return workspaceId;
}

/** Create and persist a new discount code, returning the stored record. */
export async function createDiscount(
  input: CreateDiscountInput,
  workspaceId: string,
): Promise<DiscountCode> {
  const row = await db.discountCode.create({
    data: {
      workspaceId: await resolveWorkspaceId(input.eventId, workspaceId),
      eventId: input.eventId,
      sessionId: input.sessionId ?? null,
      code: normalizeCode(input.code),
      kind: DISCOUNT_KIND_TO_DB[input.kind],
      value: input.value,
      maxRedemptions: input.maxRedemptions,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    },
  });
  return toDiscount(row);
}

/**
 * Validate a redemption of `rawCode` against an order. Returns a discriminated
 * result carrying either the computed discount or a Persian failure reason.
 */
export async function validateDiscount(
  rawCode: string,
  eventId: string,
  subtotal: Money,
  sessionId?: string,
): Promise<DiscountValidation> {
  const code = normalizeCode(rawCode);
  if (!code) {
    return checkDiscountEligibility({
      rawCode,
      discount: undefined,
      eventId,
      sessionId,
      subtotal,
    });
  }

  /**
   * Scoped to the event's own workspace.
   *
   * Codes are unique *per workspace*, and this looked one up by `code` alone.
   * Combined with `eventId: null` meaning "every event of the workspace", that
   * made any workspace-wide code valid against any event on the platform:
   * a 50% code issued by one organiser halved the price of another
   * organiser's ticket, funded by them, and burned the issuer's redemption
   * count doing it.
   */
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { workspaceId: true },
  });
  const row = event
    ? await db.discountCode.findFirst({
        where: { code, workspaceId: event.workspaceId },
      })
    : null;

  return checkDiscountEligibility({
    rawCode,
    discount: row ? toDiscount(row) : undefined,
    eventId,
    sessionId,
    subtotal,
  });
}
