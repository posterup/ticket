/**
 * Zarinpal v4 adapter.
 *
 * Only the HTTP calls live here. Amount conversion and response-code meaning
 * are in `./zarinpal-codes`, which is pure and tested — this file is the thin
 * part that cannot be verified without a merchant id.
 */

import type { Money } from "@/types";

import type { PaymentGateway, RequestResult, VerifyResult } from "./gateway";
import {
  extractCode,
  failureMessage,
  gatewayAmount,
  isRetryable,
  ZARINPAL_CURRENCY,
  type ZarinpalEnvelope,
} from "./zarinpal-codes";

const LIVE = "https://payment.zarinpal.com";
const SANDBOX = "https://sandbox.zarinpal.com";

function baseUrl(sandbox: boolean): string {
  return sandbox ? SANDBOX : LIVE;
}

function merchantId(): string {
  const value = process.env.ZARINPAL_MERCHANT_ID;
  if (!value) {
    throw new Error(
      "ZARINPAL_MERCHANT_ID is not set. See .env.example, or use PAYMENT_PROVIDER=mock.",
    );
  }
  return value;
}

async function post(
  url: string,
  body: unknown,
): Promise<ZarinpalEnvelope | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as ZarinpalEnvelope;
  } catch {
    return null;
  }
}

export function createZarinpalGateway(sandbox: boolean): PaymentGateway {
  const base = baseUrl(sandbox);

  return {
    provider: sandbox ? "zarinpal-sandbox" : "zarinpal",

    async request(input): Promise<RequestResult> {
      const envelope = await post(`${base}/pg/v4/payment/request.json`, {
        merchant_id: merchantId(),
        // Converted exactly once, here. A Toman figure reaching Zarinpal by
        // any other path is wrong by a factor of ten.
        amount: gatewayAmount(input.amountToman, ZARINPAL_CURRENCY),
        currency: ZARINPAL_CURRENCY,
        description: input.description,
        callback_url: input.callbackUrl,
        metadata: input.mobile ? { mobile: input.mobile } : undefined,
      });

      if (!envelope) {
        return {
          ok: false,
          code: "NETWORK",
          message: "ارتباط با درگاه پرداخت برقرار نشد.",
          retryable: true,
        };
      }

      const code = extractCode(envelope);
      const authority = envelope.data?.authority;
      // Fail closed: a reply we cannot read is not a success.
      if (code !== 100 || !authority) {
        return {
          ok: false,
          code: String(code ?? "UNKNOWN"),
          message: failureMessage(code ?? 0),
          retryable: code !== null && isRetryable(code),
        };
      }

      return {
        ok: true,
        authority,
        redirectUrl: `${base}/pg/StartPay/${authority}`,
      };
    },

    async verify({ authority, amountToman }): Promise<VerifyResult> {
      const envelope = await post(`${base}/pg/v4/payment/verify.json`, {
        merchant_id: merchantId(),
        amount: gatewayAmount(amountToman as Money, ZARINPAL_CURRENCY),
        authority,
      });

      if (!envelope) {
        return { ok: false, code: "NETWORK", message: "ارتباط با درگاه برقرار نشد." };
      }

      const code = extractCode(envelope);
      // 100 is verified, 101 is *already* verified — both mean the money
      // settled, and treating 101 as a failure would strand a paying customer.
      if (code === 100 || code === 101) {
        return {
          ok: true,
          refId: String(envelope.data?.ref_id ?? ""),
          cardPan: envelope.data?.card_pan,
          alreadyVerified: code === 101,
        };
      }

      return {
        ok: false,
        code: String(code ?? "UNKNOWN"),
        message: failureMessage(code ?? 0),
      };
    },
  };
}
