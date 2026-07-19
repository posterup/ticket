import { NextResponse } from "next/server";

import { segmentEmails } from "@/lib/server";
import { sendBulkEmail } from "@/lib/server/email/resend";

/** POST /api/email/send - send an email campaign to a segment via Resend. */
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

  const { segmentId, subject, message } = (body ?? {}) as Record<string, unknown>;
  if (
    typeof segmentId !== "string" ||
    typeof subject !== "string" ||
    typeof message !== "string" ||
    !subject.trim() ||
    !message.trim()
  ) {
    return NextResponse.json(
      { error: { message: "segmentId، subject و message الزامی است.", code: "INVALID_BODY" } },
      { status: 400 },
    );
  }

  const result = await sendBulkEmail(segmentEmails(segmentId), subject, message);
  if (!result.ok) {
    return NextResponse.json(
      { error: { message: result.error, code: "EMAIL_FAILED" } },
      { status: 502 },
    );
  }
  return NextResponse.json({ data: { sent: result.sent } });
}
