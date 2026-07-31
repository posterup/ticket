/**
 * Kavenegar (kavenegar.com), server-only.
 *
 *   KAVENEGAR_API_KEY       the API key — goes in the URL path, not a header
 *   KAVENEGAR_SENDER        optional sender line; omit to use the account default
 *   KAVENEGAR_OTP_TEMPLATE  approved template name for one-time codes
 *
 * Kavenegar answers 200 with the real outcome inside `return.status`, so an
 * `res.ok` check alone would treat a rejected send as a success. Both paths
 * below read the envelope.
 */

import {
  type SendSmsResult,
  type SmsGateway,
  combineBatches,
  inBatches,
  validRecipients,
  normalizeMobile,
} from "./gateway";

const BASE = "https://api.kavenegar.com/v1";

interface KavenegarEnvelope {
  return?: { status?: number; message?: string };
  entries?: unknown[] | null;
}

/**
 * Kavenegar's own status codes are more useful than the HTTP status.
 *
 * On success the count comes from `entries` — one element per message the
 * operator actually accepted. It is not always the number asked for: a receptor
 * the operator rejects is simply absent from the array while `return.status`
 * stays 200, so counting the request instead of the response reported delivery
 * to numbers that were never sent to. `accepted` falls back to the requested
 * count only when the array is missing entirely.
 */
async function readEnvelope(
  res: Response,
  requested: number,
): Promise<SendSmsResult> {
  const body = (await res.json().catch(() => null)) as KavenegarEnvelope | null;
  const status = body?.return?.status;
  if (status === 200) {
    const accepted = Array.isArray(body?.entries)
      ? body.entries.length
      : requested;
    return { ok: true, sent: accepted };
  }
  return {
    ok: false,
    sent: 0,
    error:
      body?.return?.message ??
      `خطای سرویس پیامک کاوه‌نگار (${status ?? res.status}).`,
  };
}

export function createKavenegarGateway(): SmsGateway {
  const apiKey = process.env.KAVENEGAR_API_KEY;

  return {
    provider: "kavenegar",
    configured: Boolean(apiKey),

    async sendBulk(mobiles, message) {
      if (!apiKey) {
        return {
          ok: false,
          sent: 0,
          error: "سرویس پیامک پیکربندی نشده است (KAVENEGAR_API_KEY).",
        };
      }
      const recipients = validRecipients(mobiles);
      if (!recipients.length) {
        return { ok: false, sent: 0, error: "مخاطب موبایل معتبری یافت نشد." };
      }

      const sender = process.env.KAVENEGAR_SENDER;
      const results: SendSmsResult[] = [];

      // Sequential, not `Promise.all`: a segment of ten thousand is fifty calls,
      // and firing them at once is how an account meets its rate limit.
      for (const batch of inBatches(recipients)) {
        const params = new URLSearchParams({
          receptor: batch.join(","),
          message,
        });
        if (sender) params.set("sender", sender);

        try {
          // POSTed as a form body rather than a query string: message text is
          // Persian and long, and URLs have length limits.
          const res = await fetch(`${BASE}/${apiKey}/sms/send.json`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
          });
          results.push(await readEnvelope(res, batch.length));
        } catch {
          results.push({
            ok: false,
            sent: 0,
            error: "ارتباط با سرویس پیامک برقرار نشد.",
          });
        }
      }
      return combineBatches(results);
    },

    async sendVerify(mobile, code) {
      const template = process.env.KAVENEGAR_OTP_TEMPLATE;
      if (!apiKey || !template) {
        return {
          ok: false,
          sent: 0,
          error:
            "سرویس پیامک پیکربندی نشده است (KAVENEGAR_API_KEY / KAVENEGAR_OTP_TEMPLATE).",
        };
      }
      const receptor = normalizeMobile(mobile);
      if (!/^09\d{9}$/.test(receptor)) {
        return { ok: false, sent: 0, error: "شماره موبایل معتبر نیست." };
      }

      const params = new URLSearchParams({ receptor, token: code, template });

      try {
        const res = await fetch(
          `${BASE}/${apiKey}/verify/lookup.json?${params.toString()}`,
          { method: "GET" },
        );
        const result = await readEnvelope(res, 1);
        // The verify endpoint sends exactly one message; `entries` echoes it.
        return result.ok ? { ok: true, sent: 1 } : result;
      } catch {
        return { ok: false, sent: 0, error: "ارتباط با سرویس پیامک برقرار نشد." };
      }
    },
  };
}
