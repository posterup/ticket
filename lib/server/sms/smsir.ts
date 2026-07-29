/**
 * sms.ir SMS gateway (server-only). Credentials come from env:
 *   SMSIR_API_KEY       - your sms.ir API key
 *   SMSIR_LINE_NUMBER   - your sender line number
 * Never hard-code these. Calls the sms.ir v1 bulk-send endpoint at request time.
 */

const ENDPOINT = "https://api.sms.ir/v1/send/bulk";

export interface SendSmsResult {
  ok: boolean;
  sent: number;
  error?: string;
}

/** Normalize an Iranian mobile to the `09xxxxxxxxx` form sms.ir expects. */
export function normalizeMobile(raw: string): string {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+98")) d = "0" + d.slice(3);
  else if (d.startsWith("98") && d.length === 12) d = "0" + d.slice(2);
  else if (d.startsWith("9") && d.length === 10) d = "0" + d;
  return d;
}

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

  const recipients = [
    ...new Set(mobiles.map(normalizeMobile).filter((m) => /^09\d{9}$/.test(m))),
  ];
  if (recipients.length === 0) {
    return { ok: false, sent: 0, error: "مخاطب موبایل معتبری یافت نشد." };
  }

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
        mobiles: recipients,
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | { status?: number; message?: string }
      | null;

    if (!res.ok || (data && data.status !== 1)) {
      return {
        ok: false,
        sent: 0,
        error: data?.message ?? `خطای سرویس پیامک (${res.status}).`,
      };
    }
    return { ok: true, sent: recipients.length };
  } catch {
    return { ok: false, sent: 0, error: "ارتباط با سرویس پیامک برقرار نشد." };
  }
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
