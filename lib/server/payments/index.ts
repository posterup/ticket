/**
 * Gateway selection.
 *
 * Defaults to the mock in development, so a checkout works on a fresh clone
 * with no credentials. Production must name its gateway explicitly — the
 * fallback is refused there rather than silently settling orders for free.
 */

import type { PaymentGateway } from "./gateway";
import { mockGateway } from "./mock";
import { createZarinpalGateway } from "./zarinpal";

export type { PaymentGateway } from "./gateway";
export * from "./zarinpal-codes";

export function paymentGateway(): PaymentGateway {
  const provider = process.env.PAYMENT_PROVIDER;

  switch (provider) {
    case "zarinpal":
      return createZarinpalGateway(false);
    case "zarinpal-sandbox":
      return createZarinpalGateway(true);
    case "mock":
      return mockGateway;
    case undefined:
    case "":
      // The mock settles in-process without taking money, so falling back to
      // it on a production deploy would hand out paid tickets for free. A
      // staging deploy that genuinely wants it can still set "mock" by name.
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "PAYMENT_PROVIDER is not set. Production will not fall back to the " +
            "mock gateway, which settles orders without taking payment. Set " +
            "it to 'zarinpal', 'zarinpal-sandbox', or an explicit 'mock'.",
        );
      }
      return mockGateway;
    default:
      throw new Error(
        `PAYMENT_PROVIDER is '${provider}', which is not a known gateway. ` +
          "Expected 'zarinpal', 'zarinpal-sandbox', or 'mock'.",
      );
  }
}
