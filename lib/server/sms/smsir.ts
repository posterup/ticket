/**
 * sms.ir SMS gateway (server-only). Credentials come from env:
 *   SMSIR_API_KEY       - your sms.ir API key
 *   SMSIR_LINE_NUMBER   - your sender line number
 * Never hard-code these. Calls the sms.ir v1 bulk-send endpoint at request time.
 */

import {
  type SendSmsResult,
  type SmsGateway,
  combineBatches,
  inBatches,
  normalizeMobile,
  validRecipients,
} from "./gateway";

const ENDPOINT = "https://api.sms.ir/v1/send/bulk";

// Re-exported so the pre-existing `normalizeMobile` import path keeps working.
export { normalizeMobile };
export type { SendSmsResult };

export async function sendBulkSms(
  mobiles: string[],
  message: string,
): Promise<SendSmsResult> {
  const apiKey = process.env.SMSIR_API_KEY;
  const lineNumber = process.env.SMSIR_LINE_NUMBER;
  if (!apiKey || !lineNumber) {
    return {
      ok: false,
      sent: 0,
      error: "سرویس پیامک پیکربندی نشده است (SMSIR_API_KEY / SMSIR_LINE_NUMBER).",
    };
  }

  const recipients = validRecipients(mobiles);
  if (recipients.length === 0) {
    return { ok: false, sent: 0, error: "مخاطب موبایل معتبری یافت نشد." };
  }

  // Batched for the same reason Kavenegar is — see `SMS_BATCH_SIZE`. A segment
  // has no size limit, an operator request does, and posting the whole list
  // meant a large campaign failed entirely rather than sending.
  const results: SendSmsResult[] = [];
  for (const batch of inBatches(recipients)) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify({
          lineNumber: Number(lineNumber),
          messageText: message,
          mobiles: batch,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { status?: number; message?: string }
        | null;

      if (!res.ok || (data && data.status !== 1)) {
        results.push({
          ok: false,
          sent: 0,
          error: data?.message ?? `خطای سرویس پیامک (${res.status}).`,
        });
        continue;
      }
      results.push({ ok: true, sent: batch.length });
    } catch {
      results.push({
        ok: false,
        sent: 0,
        error: "ارتباط با سرویس پیامک برقرار نشد.",
      });
    }
  }
  return combineBatches(results);
}

/** sms.ir routes one-time codes through the verify/pattern API, not bulk. */
const VERIFY_ENDPOINT = "https://api.sms.ir/v1/send/verify";

/**
 * Send a one-time code via sms.ir's verify/pattern API.
 *
 * Operator policy routes OTPs through an approved template rather than the
 * bulk endpoint — bulk-sent codes are commonly filtered — so this needs
 * `SMSIR_OTP_TEMPLATE_ID` in addition to the API key. The template is expected
 * to take a single `CODE` parameter.
 */
export async function sendVerifySms(
  mobile: string,
  code: string,
): Promise<SendSmsResult> {
  const apiKey = process.env.SMSIR_API_KEY;
  const templateId = process.env.SMSIR_OTP_TEMPLATE_ID;
  if (!apiKey || !templateId) {
    return {
      ok: false,
      sent: 0,
      error:
        "سرویس پیامک پیکربندی نشده است (SMSIR_API_KEY / SMSIR_OTP_TEMPLATE_ID).",
    };
  }

  const recipient = normalizeMobile(mobile);
  if (!/^09\d{9}$/.test(recipient)) {
    return { ok: false, sent: 0, error: "شماره موبایل معتبر نیست." };
  }

  try {
    const res = await fetch(VERIFY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        mobile: recipient,
        templateId: Number(templateId),
        parameters: [{ name: "CODE", value: code }],
      }),
    });
    if (!res.ok) {
      return { ok: false, sent: 0, error: `خطای سرویس پیامک (${res.status}).` };
    }
    return { ok: true, sent: 1 };
  } catch {
    return { ok: false, sent: 0, error: "ارتباط با سرویس پیامک برقرار نشد." };
  }
}

/** The gateway façade over the two functions above. */
export function createSmsIrGateway(): SmsGateway {
  return {
    provider: "smsir",
    configured: Boolean(
      process.env.SMSIR_API_KEY && process.env.SMSIR_LINE_NUMBER,
    ),
    sendBulk: sendBulkSms,
    sendVerify: sendVerifySms,
  };
}
