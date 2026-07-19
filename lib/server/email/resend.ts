/**
 * Resend transactional email (server-only). No mail server needed - this runs
 * in a Route Handler (serverless). Credentials come from env:
 *   RESEND_API_KEY  - your Resend API key
 *   EMAIL_FROM      - verified sender, e.g. `پوستر <noreply@yourdomain.ir>`
 */

const ENDPOINT = "https://api.resend.com/emails/batch";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface SendEmailResult {
  ok: boolean;
  sent: number;
  error?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendBulkEmail(
  emails: string[],
  subject: string,
  message: string,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return {
      ok: false,
      sent: 0,
      error: "سرویس ایمیل پیکربندی نشده است (RESEND_API_KEY / EMAIL_FROM).",
    };
  }

  const recipients = [...new Set(emails.filter((e) => EMAIL_RE.test(e)))];
  if (recipients.length === 0) {
    return { ok: false, sent: 0, error: "ایمیل معتبری یافت نشد." };
  }

  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:14px;line-height:1.9;color:#111111">${escapeHtml(
    message,
  ).replace(/\n/g, "<br>")}</div>`;

  // Resend batch: up to 100 messages per call.
  const batch = recipients.slice(0, 100).map((to) => ({
    from,
    to: [to],
    subject,
    html,
  }));

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });
    const data = (await res.json().catch(() => null)) as
      | { message?: string }
      | null;
    if (!res.ok) {
      return {
        ok: false,
        sent: 0,
        error: data?.message ?? `خطای سرویس ایمیل (${res.status}).`,
      };
    }
    return { ok: true, sent: batch.length };
  } catch {
    return { ok: false, sent: 0, error: "ارتباط با سرویس ایمیل برقرار نشد." };
  }
}
