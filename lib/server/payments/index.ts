/**
 * Gateway selection.
 *
 * Defaults to the mock, so a checkout works on a fresh clone with no
 * credentials. Production must opt in explicitly.
 */

import type { PaymentGateway } from "./gateway";
import { mockGateway } from "./mock";
import { createZarinpalGateway } from "./zarinpal";

export type { PaymentGateway } from "./gateway";
export * from "./zarinpal-codes";

export function paymentGateway(): PaymentGateway {
  switch (process.env.PAYMENT_PROVIDER) {
    case "zarinpal":
      return createZarinpalGateway(false);
    case "zarinpal-sandbox":
      return createZarinpalGateway(true);
    default:
      return mockGateway;
  }
}
