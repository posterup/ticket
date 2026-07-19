import type { IsoDateTime, Money } from "./api";

/** How a discount reduces the order total. */
export type DiscountKind = "percent" | "fixed";

/**
 * A promo/discount code an organizer creates and a buyer redeems at checkout.
 * `eventId === null` means the code applies to every event of the organizer.
 */
export interface DiscountCode {
  id: string;
  /** Scope: a single event, or `null` for all of the organizer's events. */
  eventId: string | null;
  /** Redemption code, stored uppercase (e.g. `WELCOME10`). */
  code: string;
  kind: DiscountKind;
  /** Percent (1–100) when `kind === "percent"`, else a Toman amount. */
  value: number;
  /** Maximum total redemptions, or `null` for unlimited. */
  maxRedemptions: number | null;
  /** Redemptions used so far. */
  redemptions: number;
  /** Expiry instant, or `null` when the code never expires. */
  expiresAt: IsoDateTime | null;
  active: boolean;
  createdAt: IsoDateTime;
}

/** Payload accepted by `createDiscount`; the server fills the rest. */
export interface CreateDiscountInput {
  eventId: string | null;
  code: string;
  kind: DiscountKind;
  value: number;
  maxRedemptions: number | null;
  expiresAt: IsoDateTime | null;
}

/** Result of validating a code against an order (discriminated on `ok`). */
export type DiscountValidation =
  | {
      ok: true;
      code: string;
      kind: DiscountKind;
      value: number;
      /** Amount subtracted from the subtotal, in Toman. */
      discountAmount: Money;
      /** Order total after the discount, in Toman. */
      total: Money;
    }
  | { ok: false; reason: string };
