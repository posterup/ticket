import { it, expect, beforeAll } from "vitest";

import { PATCH as SET_TAGS } from "@/app/api/attendees/[id]/route";
import { POST as SEND_SMS } from "@/app/api/sms/send/route";
import type { Attendee } from "@/types";

import { ctx, data, errorCode, parse, req , describeApi , signInAsOwner } from "./helpers";

const SEED_ATTENDEE = "e1000000-0000-4000-8000-000000000001";
const AVA_WORKSPACE = "w1000000-0000-4000-8000-000000000001";

// Organiser-side endpoints: run as the seeded owner.
beforeAll(async () => {
  if (process.env.DATABASE_URL) await signInAsOwner();
});

describeApi("PATCH /api/attendees/:id", () => {
  it("replaces the contact's tags", async () => {
    const attendee = data(
      await parse<Attendee>(
        await SET_TAGS(
          req("PATCH", "/", { tags: ["وفادار", "وی‌آی‌پی"] }),
          ctx({ id: SEED_ATTENDEE }),
        ),
      ),
    );
    // Order is stable but collation-dependent, so compare as a set.
    expect(new Set(attendee.tags.map((t) => t.label))).toEqual(
      new Set(["وفادار", "وی‌آی‌پی"]),
    );
  });

  it("accepts an empty list, clearing the tags", async () => {
    const attendee = data(
      await parse<Attendee>(
        await SET_TAGS(req("PATCH", "/", { tags: [] }), ctx({ id: SEED_ATTENDEE })),
      ),
    );
    expect(attendee.tags).toEqual([]);
  });

  it("rejects tags that are not an array of strings", async () => {
    for (const tags of ["nope", [1, 2], null]) {
      const parsed = await parse<Attendee>(
        await SET_TAGS(req("PATCH", "/", { tags }), ctx({ id: SEED_ATTENDEE })),
      );
      expect(parsed.status).toBe(400);
      expect(errorCode(parsed)).toBe("INVALID_BODY");
    }
  });

  it("404s an unknown contact", async () => {
    const parsed = await parse<Attendee>(
      await SET_TAGS(req("PATCH", "/", { tags: [] }), ctx({ id: "nope" })),
    );
    expect(parsed.status).toBe(404);
    expect(errorCode(parsed)).toBe("NOT_FOUND");
  });
});

// Check-in moved to tests/api/checkin.test.ts when it started scanning real
// tickets — the synthetic holder ids it used to assert no longer exist.

describeApi("POST /api/sms/send", () => {
  it("reports the gateway as unconfigured when keys are absent", async () => {
    // No SMSIR_API_KEY in the test env, so the provider refuses up front —
    // which is exactly the 502 the dashboard surfaces to the organiser.
    const parsed = await parse<{ sent: number }>(
      await SEND_SMS(
        req("POST", "/", {
          workspaceId: AVA_WORKSPACE,
          segmentId: "all",
          message: "سلام",
        }),
      ),
    );
    expect(parsed.status).toBe(502);
    expect(errorCode(parsed)).toBe("SMS_FAILED");
  });

  it("requires a non-empty message", async () => {
    const parsed = await parse<{ sent: number }>(
      await SEND_SMS(
        req("POST", "/", {
          workspaceId: AVA_WORKSPACE,
          segmentId: "all",
          message: "   ",
        }),
      ),
    );
    expect(parsed.status).toBe(400);
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });

  it("requires a segmentId", async () => {
    const parsed = await parse<{ sent: number }>(
      await SEND_SMS(
        req("POST", "/", { workspaceId: AVA_WORKSPACE, message: "سلام" }),
      ),
    );
    expect(parsed.status).toBe(400);
    expect(errorCode(parsed)).toBe("INVALID_BODY");
  });
});
