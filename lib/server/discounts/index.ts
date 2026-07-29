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

/** Return discount codes, optionally scoped to a single event (plus org-wide). */
export async function listDiscounts(
  eventId?: string,
): Promise<DiscountCode[]> {
  const rows = await db.discountCode.findMany({
    where: eventId ? { OR: [{ eventId: null }, { eventId }] } : undefined,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toDiscount);
}

/**
 * The workspace a code belongs to: the event's owner when it is event-scoped,
 * otherwise the first workspace. Ownership comes from the session once auth
 * lands.
 */
async function resolveWorkspaceId(eventId: string | null): Promise<string> {
  if (eventId) {
    const event = await db.event.findUnique({
      where: { id: eventId },
      select: { workspaceId: true },
    });
    if (event) return event.workspaceId;
  }
  const first = await db.workspace.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!first) {
    throw new Error("No workspace exists to own the code — seed the database.");
  }
  return first.id;
}

/** Create and persist a new discount code, returning the stored record. */
export async function createDiscount(
  input: CreateDiscountInput,
): Promise<DiscountCode> {
  const row = await db.discountCode.create({
    data: {
      workspaceId: await resolveWorkspaceId(input.eventId),
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
): Promise<DiscountValidation> {
  const code = normalizeCode(rawCode);
  const row = code
    ? await db.discountCode.findFirst({ where: { code } })
    : null;

  return checkDiscountEligibility({
    rawCode,
    discount: row ? toDiscount(row) : undefined,
    eventId,
    subtotal,
  });
}
