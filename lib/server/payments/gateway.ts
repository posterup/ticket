/**
 * The payment gateway contract.
 *
 * Everything above this line — orders, ticket issuance, the callback route —
 * is written against the interface, so the real Zarinpal integration and the
 * mock used in development and tests are interchangeable. That is what lets
 * the whole purchase loop be exercised without a merchant id.
 */

import type { Money } from "@/types";

export interface PaymentRequest {
  orderId: string;
  /** Internal amount, always integer Toman. Converted inside the adapter. */
  amountToman: Money;
  description: string;
  callbackUrl: string;
  mobile?: string;
}

export type RequestResult =
  | { ok: true; authority: string; redirectUrl: string }
  | { ok: false; code: string; message: string; retryable: boolean };

export type VerifyResult =
  | {
      ok: true;
      refId: string;
      cardPan?: string;
      /** True when the gateway had already settled this payment. */
      alreadyVerified: boolean;
    }
  | { ok: false; code: string; message: string };

export interface PaymentGateway {
  readonly provider: string;
  request(input: PaymentRequest): Promise<RequestResult>;
  verify(input: { authority: string; amountToman: Money }): Promise<VerifyResult>;
}
