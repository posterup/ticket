/**
 * The SMS gateway contract.
 *
 * Two Iranian providers with incompatible shapes — sms.ir posts JSON with the
 * key in a header, Kavenegar puts the key in the URL path and answers with a
 * `return.status` envelope — so everything above this line is written against
 * the interface and neither provider leaks upward.
 *
 * One-time codes are a separate method rather than a bulk send with a
 * templated body: both operators route OTPs through an approved template, and
 * codes sent over the bulk endpoint are routinely filtered.
 */

export interface SendSmsResult {
  ok: boolean;
  sent: number;
  error?: string;
}

export interface SmsGateway {
  readonly provider: string;
  /** True when credentials are present. Callers report "not configured". */
  readonly configured: boolean;
  sendBulk(mobiles: string[], message: string): Promise<SendSmsResult>;
  sendVerify(mobile: string, code: string): Promise<SendSmsResult>;
}

/** Normalize an Iranian mobile to the `09xxxxxxxxx` form both operators want. */
export function normalizeMobile(raw: string): string {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+98")) d = "0" + d.slice(3);
  else if (d.startsWith("98") && d.length === 12) d = "0" + d.slice(2);
  else if (d.startsWith("9") && d.length === 10) d = "0" + d;
  return d;
}

export function validRecipients(mobiles: string[]): string[] {
  return [
    ...new Set(mobiles.map(normalizeMobile).filter((m) => /^09\d{9}$/.test(m))),
  ];
}

/**
 * Every spelling of the same Iranian mobile, for matching stored data.
 *
 * `Attendee.phone` is written exactly as it arrived and never normalised, so the
 * same person is `+989121234567` in one row and `09121234567` in another — the
 * seed fixtures alone contain both. Any lookup that compares against one form
 * therefore misses the rest of them, silently.
 *
 * That is not hypothetical. «مخاطبان هدف» matched a single spelling on both
 * sides: `listEvents` looked up `phone: viewer.phone` and the purchase gate in
 * `createOrder` tried the normalised form plus the raw input. An attendee stored
 * in E.164 matched neither, so the event was missing from their listing *and*
 * refused at checkout with «این رویداد فقط برای مخاطبان دعوت‌شده است» — the
 * targeting feature excluding the people it was aimed at.
 *
 * The real fix is normalising on write; that needs a migration and a backfill.
 * This makes reads correct in the meantime, and stays correct afterwards.
 */
export function phoneVariants(raw: string): string[] {
  const local = normalizeMobile(raw); //  09xxxxxxxxx
  if (!/^09\d{9}$/.test(local)) return [raw.trim()].filter(Boolean);
  const bare = local.slice(1); //         9xxxxxxxxx
  return [...new Set([local, `+98${bare}`, `98${bare}`, bare, raw.trim()])];
}

/**
 * Largest recipient list either operator accepts in one call.
 *
 * Both gateways took the whole segment and posted it as a single request, so a
 * campaign to more people than this was rejected *in full* — one operator error
 * and nobody heard from the organiser. The dashboard let a workspace build a
 * segment of any size, which is precisely how a marketing tool is meant to be
 * used, so this was the failure waiting for the first real send.
 *
 * 200 is Kavenegar's documented ceiling for a comma-joined `receptor`, and
 * comfortably under sms.ir's; taking the lower of the two keeps one number to
 * reason about instead of two.
 */
export const SMS_BATCH_SIZE = 200;

/** Split recipients into operator-sized calls. Never yields an empty batch. */
export function inBatches<T>(items: T[], size = SMS_BATCH_SIZE): T[][] {
  if (size < 1) throw new RangeError("batch size must be at least 1");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Fold per-batch outcomes into one answer.
 *
 * `sent` is the sum of what actually went, so a campaign that half-failed
 * reports the half — the previous code returned `recipients.length` on any
 * accepted call, which told an organiser their message reached people it never
 * reached. `ok` is true only when every batch succeeded, and the first real
 * error is the one surfaced: later ones are usually the same outage twice.
 */
export function combineBatches(results: SendSmsResult[]): SendSmsResult {
  const sent = results.reduce((n, r) => n + r.sent, 0);
  const failure = results.find((r) => !r.ok);
  return failure
    ? { ok: false, sent, error: failure.error }
    : { ok: true, sent };
}
