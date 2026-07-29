/**
 * Zarinpal amount conversion and response-code classification — pure.
 *
 * Split out from the HTTP adapter so the two things most likely to be wrong
 * can be tested without a merchant id or a network call:
 *
 *  1. **The currency unit.** Zarinpal's v4 API takes `amount` in *Rial* unless
 *     the request also carries `currency: "IRT"`. This codebase is integer
 *     Toman everywhere (`Money`). Getting that wrong does not error — it
 *     silently charges, or refunds, ten times the intended amount.
 *  2. **The verify codes.** `100` means verified and `101` means *already*
 *     verified. Treating `101` as a failure would strand a customer who has
 *     genuinely paid, which in Iran means a manual refund.
 *
 * Nothing here performs I/O.
 */

import type { Money } from "@/types";

/** The unit Zarinpal should read `amount` in. */
export type ZarinpalCurrency = "IRR" | "IRT";

/**
 * What we send. Toman is the currency the product quotes and stores, so we
 * declare it rather than pre-multiplying and hoping the default holds.
 */
export const ZARINPAL_CURRENCY: ZarinpalCurrency = "IRT";

/** Rial per Toman. */
const RIAL_PER_TOMAN = 10;

/** Zarinpal rejects payments below 1,000 Rial (100 Toman). */
export const MIN_AMOUNT_TOMAN = 100;

/**
 * Convert an internal Toman amount into the number to put in `amount`, for the
 * `currency` being declared alongside it.
 *
 * Call this exactly once, in the adapter. If a Toman figure reaches Zarinpal
 * without passing through here, assume it is wrong by a factor of ten.
 */
export function gatewayAmount(
  toman: Money,
  currency: ZarinpalCurrency = ZARINPAL_CURRENCY,
): number {
  if (!Number.isInteger(toman)) {
    throw new Error(`Amount must be an integer Toman value, got ${toman}.`);
  }
  if (toman < MIN_AMOUNT_TOMAN) {
    throw new Error(
      `Amount ${toman} Toman is below Zarinpal's ${MIN_AMOUNT_TOMAN} Toman minimum.`,
    );
  }
  return currency === "IRT" ? toman : toman * RIAL_PER_TOMAN;
}

/** Convert a gateway `amount` back to Toman, for reconciliation. */
export function tomanFromGatewayAmount(
  amount: number,
  currency: ZarinpalCurrency = ZARINPAL_CURRENCY,
): Money {
  return currency === "IRT" ? amount : Math.round(amount / RIAL_PER_TOMAN);
}

/**
 * Persian messages for the failure codes worth distinguishing to a buyer.
 * Anything absent falls back to a generic message — Zarinpal's own strings are
 * English and leak internals.
 */
const FAILURE_MESSAGES: Record<number, string> = {
  [-9]: "اطلاعات پرداخت نامعتبر است.",
  [-10]: "درگاه پرداخت پیکربندی نشده است.",
  [-11]: "درخواست پرداخت یافت نشد.",
  [-12]: "تلاش بیش از حد. کمی بعد دوباره امتحان کنید.",
  [-15]: "درگاه پرداخت غیرفعال است.",
  [-16]: "درگاه پرداخت در دسترس نیست.",
  [-30]: "امکان پرداخت با این مبلغ وجود ندارد.",
  [-31]: "حساب پذیرنده برای پرداخت آماده نیست.",
  [-33]: "مبلغ پرداخت با مبلغ سفارش هم‌خوانی ندارد.",
  [-34]: "سقف تراکنش رد شده است.",
  [-40]: "دسترسی به این عملیات مجاز نیست.",
  [-51]: "پرداخت ناموفق بود.",
  [-52]: "خطای غیرمنتظره در درگاه پرداخت.",
  [-53]: "این پرداخت متعلق به فروشگاه دیگری است.",
  [-54]: "درخواست پرداخت منقضی شده است.",
};

const GENERIC_FAILURE = "پرداخت انجام نشد.";

/** Human-readable Persian reason for a Zarinpal failure code. */
export function failureMessage(code: number): string {
  return FAILURE_MESSAGES[code] ?? GENERIC_FAILURE;
}

/**
 * Codes worth retrying: transient gateway trouble rather than a rejected or
 * already-settled payment. A caller should never auto-retry anything else.
 */
const RETRYABLE = new Set([-12, -16, -52]);

export function isRetryable(code: number): boolean {
  return RETRYABLE.has(code);
}

/** Outcome of `POST /pg/v4/payment/request.json`, by response code. */
export type RequestClassification = "created" | "failed";

export function classifyRequestCode(code: number): RequestClassification {
  return code === 100 ? "created" : "failed";
}

/**
 * Outcome of `POST /pg/v4/payment/verify.json`, by response code.
 *
 * `already-verified` (101) is a **success**: the payment settled and a second
 * verify arrived — a double callback, or the buyer using the back button. The
 * caller must return the existing tickets rather than issuing more.
 */
export type VerifyClassification = "verified" | "already-verified" | "failed";

export function classifyVerifyCode(code: number): VerifyClassification {
  if (code === 100) return "verified";
  if (code === 101) return "already-verified";
  return "failed";
}

/** Whether a verify code means the money is settled, however it got there. */
export function isSettled(code: number): boolean {
  return classifyVerifyCode(code) !== "failed";
}

/** The shape Zarinpal v4 replies with. `errors` is `[]` on success. */
export interface ZarinpalEnvelope {
  data?: {
    code?: number;
    message?: string;
    authority?: string;
    ref_id?: number | string;
    card_pan?: string;
  } | null;
  errors?: { code?: number; message?: string }[] | Record<string, unknown>;
}

/**
 * Pull the response code out of an envelope.
 *
 * Zarinpal reports failures inconsistently — sometimes a non-100 `data.code`,
 * sometimes an `errors` array, and on validation failures `errors` is an
 * object keyed by field rather than an array. Returns `null` when no code can
 * be found, which the adapter must treat as a failure rather than a success.
 */
export function extractCode(envelope: ZarinpalEnvelope): number | null {
  const dataCode = envelope.data?.code;
  if (typeof dataCode === "number") return dataCode;

  const { errors } = envelope;
  if (Array.isArray(errors)) {
    const code = errors[0]?.code;
    if (typeof code === "number") return code;
  } else if (errors && typeof errors === "object") {
    const code = (errors as { code?: unknown }).code;
    if (typeof code === "number") return code;
  }
  return null;
}
