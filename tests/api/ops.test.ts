import { it, expect, beforeAll } from "vitest";

import { PATCH as SET_TAGS } from "@/app/api/attendees/[id]/route";
import { POST as CHECKIN } from "@/app/api/checkin/route";
import { POST as SEND_SMS } from "@/app/api/sms/send/route";
import type { Attendee } from "@/types";

import { ctx, data, errorCode, parse, req , describeApi , signInAsOwner } from "./helpers";

const SEED_ATTENDEE = "e1000000-0000-4000-8000-000000000001";
const SEED_EVENT = "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01";
const AVA_WORKSPACE = "w1000000-0000-4000-8000-000000000001";
/** Holder ids encode their event, which is how check-in is authorised. */
const HOLDER = `${SEED_EVENT}-h1`;

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
    expect(attendee.tags.map((t) => t.label)).toEqual(["وفادار", "وی‌آی‌پی"]);
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

describeApi("POST /api/checkin", () => {
  it("records and clears a check-in", async () => {
    const on = data(
      await parse<{ holderId: string; checked: boolean }>(
        await CHECKIN(req("POST", "/", { holderId: HOLDER, checked: true })),
      ),
    );
    expect(on).toEqual({ holderId: HOLDER, checked: true });

    const off = data(
      await parse<{ holderId: string; checked: boolean }>(
        await CHECKIN(req("POST", "/", { holderId: HOLDER, checked: false })),
      ),
    );
    expect(off.checked).toBe(false);
  });

  it("requires a non-empty holderId and a boolean", async () => {
    for (const body of [
      { holderId: "", checked: true },
      { holderId: HOLDER, checked: "yes" },
      { holderId: HOLDER },
    ]) {
      const parsed = await parse(await CHECKIN(req("POST", "/", body)));
      expect(parsed.status).toBe(400);
      expect(errorCode(parsed)).toBe("INVALID_BODY");
    }
  });

  it("rejects malformed JSON", async () => {
    const parsed = await parse(await CHECKIN(req("POST", "/", "{oops")));
    expect(errorCode(parsed)).toBe("INVALID_JSON");
  });
});

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
