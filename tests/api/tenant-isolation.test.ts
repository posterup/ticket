/**
 * One organiser must not reach another organiser's data.
 *
 * Written after a sweep found three real cross-tenant leaks in the discount
 * module — a code lookup with no workspace filter that let any workspace-wide
 * code discount any event on the platform, a listing that returned rival
 * workspaces' code strings and redemption counts, and a create path that
 * assigned org-wide codes to "whichever workspace existed first".
 *
 * Reading route by route found those, but only because I happened to read the
 * right file. This is the standing check: for every workspace-scoped surface,
 * sign in as one owner and reach for another owner's data. Nothing here should
 * ever return 200.
 */

import { it, expect, beforeAll, afterAll } from "vitest";

import { GET as FINANCE } from "@/app/api/workspaces/[slug]/finance/route";
import { POST as BANK_ADD } from "@/app/api/workspaces/[slug]/bank-accounts/route";
import {
  DELETE as BANK_DELETE,
  PATCH as BANK_DEFAULT,
} from "@/app/api/workspaces/[slug]/bank-accounts/[accountId]/route";
import { POST as WITHDRAW } from "@/app/api/workspaces/[slug]/withdrawals/route";
import { GET as WS_ATTENDEES } from "@/app/api/workspaces/[slug]/attendees/route";
import { PATCH as WS_EDIT } from "@/app/api/workspaces/[slug]/route";
import { GET as DISCOUNTS } from "@/app/api/discounts/route";
import { GET as ADMIN_PAYOUTS } from "@/app/api/admin/payouts/route";

import { ctx, describeApi, req, signInAs, signOut } from "./helpers";

/**
 * Two seeded owners who share nothing.
 *
 * The caller is deliberately **negar-karimi**, not ava-events: the ava-events
 * owner carries `platformAdmin` in the seed, so `/api/admin/*` correctly
 * answers them and the most interesting case in this file would silently
 * assert nothing. A plain organiser is the realistic attacker anyway.
 */
const MINE = "09120000002"; // نگار کریمی — a plain organiser
const MY_SLUG = "negar-karimi";
const THEIRS_SLUG = "ava-events"; // استودیو رویداد آوا

let theirEventId = "";
let theirAccountId = "";
let createdAccount = false;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { db } = await import("@/lib/server/db");

  const workspace = await db.workspace.findUniqueOrThrow({
    where: { slug: THEIRS_SLUG },
    select: { id: true },
  });

  theirEventId =
    (
      await db.event.findFirst({
        where: { workspaceId: workspace.id },
        orderBy: { id: "asc" },
        select: { id: true },
      })
    )?.id ?? "";

  // They need a bank account for the per-account routes to be reachable at all.
  const existing = await db.bankAccount.findFirst({
    where: { workspaceId: workspace.id },
    select: { id: true },
  });
  if (existing) {
    theirAccountId = existing.id;
  } else {
    theirAccountId = (
      await db.bankAccount.create({
        data: {
          workspaceId: workspace.id,
          iban: "IR000000000000000000009999",
          bankName: "بانک آزمون",
          holder: "استودیو رویداد آوا",
          isDefault: true,
        },
        select: { id: true },
      })
    ).id;
    createdAccount = true;
  }

  await signInAs(MINE);
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  await signOut();
  if (!createdAccount) return;
  const { db } = await import("@/lib/server/db");
  await db.bankAccount.deleteMany({ where: { id: theirAccountId } });
});

/** Anything but a success. 401, 403 and 404 are all acceptable answers. */
const denied = (status: number) => expect([401, 403, 404]).toContain(status);

describeApi("one organiser reaching for another's data", () => {
  it("cannot read their finances", async () => {
    const res = await FINANCE(
      req("GET", "/"),
      ctx({ slug: THEIRS_SLUG }),
    );
    denied(res.status);
  });

  it("cannot add a bank account to their workspace", async () => {
    const res = await BANK_ADD(
      req("POST", "/", {
        iban: "IR000000000000000000001111",
        bankName: "بانک آزمون",
        holder: "مهاجم",
      }),
      ctx({ slug: THEIRS_SLUG }),
    );
    denied(res.status);
  });

  it("cannot delete their bank account", async () => {
    const res = await BANK_DELETE(
      req("DELETE", "/"),
      ctx({ slug: THEIRS_SLUG, accountId: theirAccountId }),
    );
    denied(res.status);
  });

  it("cannot re-point their default payout account", async () => {
    const res = await BANK_DEFAULT(
      req("PATCH", "/"),
      ctx({ slug: THEIRS_SLUG, accountId: theirAccountId }),
    );
    denied(res.status);
  });

  it("cannot withdraw their money", async () => {
    const res = await WITHDRAW(
      req("POST", "/", { amount: 10_000, bankAccountId: theirAccountId }),
      ctx({ slug: THEIRS_SLUG }),
    );
    denied(res.status);
  });

  it("cannot rename their workspace", async () => {
    const res = await WS_EDIT(
      req("PATCH", "/", { name: "مال من است" }),
      ctx({ slug: THEIRS_SLUG }),
    );
    denied(res.status);
  });

  it("cannot hang an arbitrary image off their profile", async () => {
    // The avatar is rendered in every visitor's browser, so the field takes
    // our own Blob host and nothing else — even from the rightful owner.
    const res = await WS_EDIT(
      req("PATCH", "/", { avatar: "https://evil.example/logo.png" }),
      ctx({ slug: MY_SLUG }),
    );
    expect(res.status).toBe(400);
  });

  it("edits its own profile, and the change persists", async () => {
    const name = `نگار کریمی ${Date.now()}`;
    const res = await WS_EDIT(
      req("PATCH", "/", { name, avatar: null }),
      ctx({ slug: MY_SLUG }),
    );
    expect(res.status).toBe(200);
    const { db } = await import("@/lib/server/db");
    const row = await db.workspace.findUniqueOrThrow({
      where: { slug: MY_SLUG },
      select: { name: true, avatar: true },
    });
    expect(row.name).toBe(name);
    expect(row.avatar).toBeNull();
    // Leave the seed as it was — other suites assert against this name.
    await db.workspace.update({
      where: { slug: MY_SLUG },
      data: { name: "نگار کریمی" },
    });
  });

  it("cannot read their CRM contacts", async () => {
    const res = await WS_ATTENDEES(req("GET", "/"), ctx({ slug: THEIRS_SLUG }));
    denied(res.status);
  });

  it("cannot read their event's discount codes", async () => {
    if (!theirEventId) return;
    const res = await DISCOUNTS(
      req("GET", `/api/discounts?eventId=${theirEventId}`),
    );
    denied(res.status);
  });

  it("cannot open the platform payout queue", async () => {
    // Every organiser's IBAN and account holder, in one response.
    const res = await ADMIN_PAYOUTS(req("GET", "/api/admin/payouts"));
    denied(res.status);
  });

  it("still reaches its own workspace, so the guards are not simply refusing everything", async () => {
    // A suite of denials proves nothing if the routes are broken for everyone.
    const res = await FINANCE(req("GET", "/"), ctx({ slug: MY_SLUG }));
    expect(res.status).toBe(200);
  });
});

describeApi("an anonymous caller", () => {
  it("is refused every workspace surface", async () => {
    await signOut();
    try {
      for (const [label, res] of [
        ["finance", await FINANCE(req("GET", "/"), ctx({ slug: MY_SLUG }))],
        [
          "attendees",
          await WS_ATTENDEES(req("GET", "/"), ctx({ slug: MY_SLUG })),
        ],
        [
          "admin payouts",
          await ADMIN_PAYOUTS(req("GET", "/api/admin/payouts")),
        ],
      ] as const) {
        expect([401, 403, 404], label).toContain(res.status);
      }
    } finally {
      await signInAs(MINE);
    }
  });
});
