/**
 * Phone one-time codes.
 *
 * Codes are stored as `hmac-sha256(code, AUTH_SECRET)`. Not bcrypt: six digits
 * is 10⁶ of entropy, so a slow hash buys nothing that the five-attempt limit
 * doesn't already provide. The pepper defends the realistic threat — a
 * read-only leak of the table — because it lives outside the database.
 *
 * Rate limits are counted from the `OtpCode` rows themselves, so there is no
 * second store to keep consistent.
 */

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { db } from "../db";
import { normalizeMobile, smsGateway } from "../sms";

export const OTP_TTL_SEC = 120;
export const OTP_RESEND_SEC = 60;
const MAX_ATTEMPTS = 5;

const PER_PHONE_HOURLY = 5;
const PER_PHONE_DAILY = 10;
const PER_IP_HOURLY = 20;

export type OtpRequestResult =
  | {
      ok: true;
      expiresInSec: number;
      resendAfterSec: number;
      /** Present only outside production, so development needs no SMS gateway. */
      devCode?: string;
    }
  | {
      ok: false;
      code: "INVALID_PHONE" | "RATE_LIMITED" | "SMS_FAILED";
      message: string;
      retryAfterSec?: number;
    };

export type OtpVerifyResult =
  | { ok: true; userId: string; isNewUser: boolean }
  | {
      ok: false;
      code: "INVALID_CODE" | "EXPIRED" | "TOO_MANY_ATTEMPTS";
      message: string;
    };

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    throw new Error(
      "AUTH_SECRET is not set — one-time codes cannot be hashed. See .env.example.",
    );
  }
  return value;
}

function hashCode(code: string): string {
  return createHmac("sha256", secret()).update(code).digest("hex");
}

/** Constant-time compare, so a wrong code leaks nothing through timing. */
function matches(candidate: string, expected: string): boolean {
  const a = Buffer.from(hashCode(candidate));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function since(ms: number): Date {
  return new Date(Date.now() - ms);
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Issue a code for `rawPhone`.
 *
 * Responses are shape-identical whether or not an account exists — the caller
 * must not be able to enumerate registered numbers.
 */
export async function requestOtp(
  rawPhone: string,
  ctx: { ip?: string } = {},
): Promise<OtpRequestResult> {
  const phone = normalizeMobile(rawPhone);
  if (!/^09\d{9}$/.test(phone)) {
    return {
      ok: false,
      code: "INVALID_PHONE",
      message: "شماره موبایل معتبر وارد کنید.",
    };
  }

  const [recent, hourly, daily, perIp] = await Promise.all([
    db.otpCode.findFirst({
      where: { phone, createdAt: { gt: since(OTP_RESEND_SEC * 1000) } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    db.otpCode.count({ where: { phone, createdAt: { gt: since(HOUR) } } }),
    db.otpCode.count({ where: { phone, createdAt: { gt: since(DAY) } } }),
    ctx.ip
      ? db.otpCode.count({ where: { ip: ctx.ip, createdAt: { gt: since(HOUR) } } })
      : Promise.resolve(0),
  ]);

  if (recent) {
    const elapsed = Math.floor((Date.now() - recent.createdAt.getTime()) / 1000);
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "کمی صبر کنید و دوباره تلاش کنید.",
      retryAfterSec: Math.max(1, OTP_RESEND_SEC - elapsed),
    };
  }
  if (hourly >= PER_PHONE_HOURLY || daily >= PER_PHONE_DAILY || perIp >= PER_IP_HOURLY) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "تعداد درخواست‌ها زیاد است. بعداً تلاش کنید.",
      retryAfterSec: OTP_RESEND_SEC,
    };
  }

  const code = String(randomInt(100_000, 1_000_000));

  // Requesting a new code invalidates any outstanding one for this number.
  await db.$transaction([
    db.otpCode.updateMany({
      where: { phone, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    db.otpCode.create({
      data: {
        phone,
        codeHash: hashCode(code),
        expiresAt: new Date(Date.now() + OTP_TTL_SEC * 1000),
        ip: ctx.ip,
      },
    }),
  ]);

  // Whichever operator is selected. Both need an approved template for codes,
  // so "has credentials" is not the same as "can send an OTP".
  const gateway = smsGateway();
  const configured =
    gateway.provider === "kavenegar"
      ? Boolean(process.env.KAVENEGAR_API_KEY && process.env.KAVENEGAR_OTP_TEMPLATE)
      : Boolean(process.env.SMSIR_API_KEY && process.env.SMSIR_OTP_TEMPLATE_ID);
  const base = {
    ok: true as const,
    expiresInSec: OTP_TTL_SEC,
    resendAfterSec: OTP_RESEND_SEC,
  };

  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        code: "SMS_FAILED",
        message: "سرویس پیامک پیکربندی نشده است.",
      };
    }
    // Development works with an empty .env: the code goes to the console and
    // back in the response, so nobody is blocked on gateway credentials.
    console.info(`[otp] ${phone} → ${code}`);
    return { ...base, devCode: code };
  }

  const sent = await gateway.sendVerify(phone, code);
  if (!sent.ok) {
    return {
      ok: false,
      code: "SMS_FAILED",
      message: sent.error ?? "ارسال پیامک ناموفق بود.",
    };
  }
  return base;
}

/**
 * Check a submitted code, and create the user on first successful login.
 *
 * A correct code is consumed immediately, so it cannot be replayed.
 */
export async function verifyOtp(
  rawPhone: string,
  submitted: string,
): Promise<OtpVerifyResult> {
  const phone = normalizeMobile(rawPhone);

  const row = await db.otpCode.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!row) {
    return {
      ok: false,
      code: "EXPIRED",
      message: "کد منقضی شده است. دوباره درخواست کنید.",
    };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    await db.otpCode.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    return {
      ok: false,
      code: "EXPIRED",
      message: "کد منقضی شده است. دوباره درخواست کنید.",
    };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await db.otpCode.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    return {
      ok: false,
      code: "TOO_MANY_ATTEMPTS",
      message: "تلاش بیش از حد. کد تازه‌ای درخواست کنید.",
    };
  }

  if (!matches(submitted.trim(), row.codeHash)) {
    await db.otpCode.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, code: "INVALID_CODE", message: "کد وارد شده درست نیست." };
  }

  await db.otpCode.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });

  const existing = await db.user.findUnique({
    where: { phone },
    select: { id: true },
  });
  if (existing) return { ok: true, userId: existing.id, isNewUser: false };

  const created = await db.user.create({ data: { phone }, select: { id: true } });
  return { ok: true, userId: created.id, isNewUser: true };
}
