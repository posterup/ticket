import { segmentMobiles } from "@/lib/server";
import { requireWorkspaceAccess } from "@/lib/server/auth/guards";
import { handler, HttpError, ok, readJson } from "@/lib/server/http";
import { sendSmsSchema } from "@/lib/server/schemas/sms";
import { sendBulkSms } from "@/lib/server/sms/smsir";

/**
 * POST /api/sms/send — send an SMS campaign to a segment via sms.ir.
 *
 * Guarded on the workspace, not merely on being signed in: this spends the
 * organiser's real SMS balance, and used to be reachable by anyone at all.
 */
export const POST = handler(async (request: Request) => {
  const { workspaceId, segmentId, message } = await readJson(
    request,
    sendSmsSchema,
  );
  await requireWorkspaceAccess(workspaceId, "campaigns:send");

  const result = await sendBulkSms(await segmentMobiles(segmentId), message);
  if (!result.ok) {
    // `error` is optional on SendSmsResult; keep the envelope's message filled.
    throw new HttpError(
      502,
      "SMS_FAILED",
      result.error ?? "ارسال پیامک ناموفق بود.",
    );
  }
  return ok({ sent: result.sent });
});
