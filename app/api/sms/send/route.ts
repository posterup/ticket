import { NextResponse } from "next/server";

import { segmentMobiles } from "@/lib/server";
import { sendBulkSms } from "@/lib/server/sms/smsir";

/** POST /api/sms/send - send an SMS campaign to a segment via sms.ir. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "بدنه نامعتبر است.", code: "INVALID_JSON" } },
      { status: 400 },
    );
  }

  const { segmentId, message } = (body ?? {}) as Record<string, unknown>;
  if (typeof segmentId !== "string" || typeof message !== "string" || !message.trim()) {
    return NextResponse.json(
      { error: { message: "segmentId و message الزامی است.", code: "INVALID_BODY" } },
      { status: 400 },
    );
  }

  const result = await sendBulkSms(segmentMobiles(segmentId), message);
  if (!result.ok) {
    return NextResponse.json(
      { error: { message: result.error, code: "SMS_FAILED" } },
      { status: 502 },
    );
  }
  return NextResponse.json({ data: { sent: result.sent } });
}
