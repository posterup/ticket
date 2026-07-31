/**
 * Gateway selection.
 *
 * `SMS_PROVIDER` names the operator. Unset falls back to whichever set of
 * credentials is actually present, so an existing deployment that only ever
 * configured sms.ir keeps working without a new variable — and a fresh one that
 * only sets `KAVENEGAR_API_KEY` works without one either.
 *
 * Unlike the payment gateway there is no production guard here: an unconfigured
 * SMS provider degrades to "not configured" and the caller reports it, which is
 * annoying but harmless. An unconfigured payment gateway gives away tickets.
 */

import { createKavenegarGateway } from "./kavenegar";
import { createSmsIrGateway } from "./smsir";
import type { SmsGateway } from "./gateway";

export type { SmsGateway, SendSmsResult } from "./gateway";
export { inBatches, normalizeMobile, phoneVariants } from "./gateway";

export function smsGateway(): SmsGateway {
  switch (process.env.SMS_PROVIDER) {
    case "kavenegar":
      return createKavenegarGateway();
    case "smsir":
      return createSmsIrGateway();
    default:
      break;
  }

  // Nothing named: prefer whichever is actually configured.
  if (process.env.KAVENEGAR_API_KEY) return createKavenegarGateway();
  return createSmsIrGateway();
}
