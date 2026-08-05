/**
 * Invariants of the seed fixtures themselves, with no database.
 *
 * `tests/seed.test.ts` checks what landed in Postgres, which is the right check
 * and the wrong moment: it needs a live database, and a fixture that references
 * a nonexistent event fails there as an opaque foreign-key error rather than as
 * "this id is a typo".
 *
 * The more interesting reason this file exists is coverage. Two bugs this
 * session survived review because the seed had no example that could show
 * them — every event was uniformly free or uniformly paid, and none was
 * restricted to a CRM segment. Both classes are now seeded, and the assertions
 * below are what stop them being quietly dropped again: they fail if the
 * *shape* disappears, not merely if a field changes.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import {
  attendees,
  events,
  ticketTypes,
  EVENT_WORKSPACE,
} from "@/prisma/seed-data";

const MIXED = "3f1a6c2e-0022-4a10-9b21-1a2b3c4d5e22";
const AUDIENCE = "3f1a6c2e-0023-4a10-9b21-1a2b3c4d5e23";

const typesFor = (eventId: string) =>
  ticketTypes.filter((t) => t.eventId === eventId);

describe("seed fixture integrity", () => {
  it("gives every ticket type a real event", () => {
    const ids = new Set(events.map((e) => e.id));
    const orphans = ticketTypes.filter((t) => !ids.has(t.eventId));
    expect(orphans.map((t) => `${t.name} → ${t.eventId}`)).toEqual([]);
  });

  it("never reuses an id", () => {
    for (const [label, list] of [
      ["event", events.map((e) => e.id)],
      ["ticket type", ticketTypes.map((t) => t.id)],
      ["venue", events.map((e) => e.venue.id)],
      ["session", events.flatMap((e) => e.sessions.map((s) => s.id))],
      ["attendee", attendees.map((a) => a.id)],
    ] as const) {
      const dupes = list.filter((id, i) => list.indexOf(id) !== i);
      expect(`${label}: ${dupes.join(", ")}`).toBe(`${label}: `);
    }
  });

  /**
   * Note the direction. Asserting that every *event* appears in the map is
   * wrong — `seed.ts` documents a fallback to the home workspace for unmapped
   * ids, and two free events have always relied on it.
   *
   * The failure worth catching is the other way round: an id in the map that
   * matches no event. That is a typo, and it does not raise anything. The event
   * it was meant to file simply falls through to the home workspace, landing in
   * the wrong tenant while every page still renders.
   */
  it("maps no workspace to an event that does not exist", () => {
    const ids = new Set(events.map((e) => e.id));
    const stale = Object.entries(EVENT_WORKSPACE).flatMap(([slug, list]) =>
      list.filter((id) => !ids.has(id)).map((id) => `${slug} → ${id}`),
    );
    expect(stale).toEqual([]);
  });

  it("never files one event under two workspaces", () => {
    const filed = Object.values(EVENT_WORKSPACE).flat();
    expect(filed.filter((id, i) => filed.indexOf(id) !== i)).toEqual([]);
  });
});

describe("the coverage the seed was missing", () => {
  it("has an event that is part free and part paid", () => {
    const types = typesFor(MIXED);
    expect(types.length).toBeGreaterThan(1);
    expect(types.some((t) => t.price === 0)).toBe(true);
    expect(types.some((t) => t.price > 0)).toBe(true);
  });

  it("has an event restricted to a CRM segment", () => {
    const event = events.find((e) => e.id === AUDIENCE);
    expect(event?.visibility).toBe("audience");
    // Empty tags fail closed everywhere, so an untagged audience event would
    // be unbuyable by anyone and would exercise nothing.
    expect(event?.audienceTags?.length ?? 0).toBeGreaterThan(0);
  });

  it("points that segment at a contact who actually carries the tag", () => {
    const event = events.find((e) => e.id === AUDIENCE)!;
    const tags = event.audienceTags ?? [];
    const inSegment = attendees.filter((a) =>
      a.tags.some((t) => tags.includes(t.label)),
    );
    // Without this the gate would refuse everyone and a broken gate would look
    // exactly like a working one.
    expect(inSegment.length).toBeGreaterThan(0);
    expect(inSegment[0].phone).toMatch(/^\+989\d{9}$/);
  });

  it("keeps the audience event in the workspace that owns the contacts", () => {
    // `seed.ts` files every attendee under HOME_WORKSPACE_SLUG, and the gate in
    // `createOrder` joins on `workspaceId`. A segment in one tenant must not
    // open a door in another, so the fixture has to sit in the same one.
    expect(EVENT_WORKSPACE["ava-events"]).toContain(AUDIENCE);
  });

  it("still has a wholly free event, so both sides of the split are covered", () => {
    const free = events.filter((e) => {
      const types = typesFor(e.id);
      return types.length > 0 && types.every((t) => t.price === 0);
    });
    expect(free.length).toBeGreaterThan(0);
  });
});

/**
 * The ticket artefact itself.
 *
 * Source-level rather than rendered, because the failure was structural: the
 * seat existed on `IssuedTicket`, was rendered on the wallet *card*, and was
 * simply never handed to `TicketPreview`. Every page looked right, every type
 * checked, and the thing a buyer holds up at a door had no seat on it.
 */
describe("the designed ticket carries the seat", () => {
  const read = (p: string) =>
    readFileSync(join(process.cwd(), p), "utf8");

  it("declares a seat on the sample it renders from", () => {
    expect(read("components/tickets/TicketPreview.tsx")).toMatch(/seat\?: string;/);
  });

  it("renders it, and not behind a show* toggle", () => {
    const src = read("components/tickets/TicketPreview.tsx");
    // The guard, not merely the identifier: `toContain("sample.seat")` alone
    // stays true when the block is disabled, because the name survives inside
    // the body it no longer renders.
    expect(src).toMatch(/\{sample\.seat \? \(/);
    expect(src).toMatch(/\{sample\.seat\}/);
    // The date and venue are optional; a seat is what an usher reads. If a
    // `showSeat` flag ever appears, this is the decision being reversed.
    expect(src).not.toMatch(/showSeat/);
  });

  it("is actually fed the buyer's seat by the wallet", () => {
    // The whole bug: `IssuedTicket.seat` populated, and never passed on.
    //
    // Matched on the behaviour — a `seat` on the sample, derived from
    // `ticket.seat` — not on how the string is built. An earlier version of this
    // pinned the exact template literal and then failed the moment that literal
    // was replaced by the shared `formatSeat`, which is a test objecting to an
    // improvement rather than catching a regression.
    const src = read("app/me/tickets/page.tsx");
    expect(src).toMatch(/seat: [^\n]*ticket\.seat/);
  });

  it("shows a seat in the organiser's preview sample", () => {
    // Otherwise the layout gets designed against a ticket one line shorter
    // than the one seated buyers receive.
    expect(read("components/tickets/TicketDesigner.tsx")).toMatch(/seat: "[^"]*ردیف/);
  });
});

/**
 * Printing the order page.
 *
 * `app/orders/[code]/page.tsx` calls itself "what a buyer prints" and puts a
 * typed fallback code under every QR so a ticket survives on paper. Nothing had
 * ever been styled for print, so the page came out with the site navigation,
 * a footer of marketing links, and tickets sliced across sheets — half a QR
 * scans as nothing, and the person at the door has the wrong half.
 */
describe("the order page survives a printer", () => {
  const css = () => readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

  const printBlock = () => {
    const src = css();
    const start = src.indexOf("@media print");
    expect(start).toBeGreaterThan(-1);
    // Crude but sufficient: read to the closing brace of the at-rule by depth.
    let depth = 0;
    for (let i = src.indexOf("{", start); i < src.length; i += 1) {
      if (src[i] === "{") depth += 1;
      else if (src[i] === "}") {
        depth -= 1;
        if (depth === 0) return src.slice(start, i + 1);
      }
    }
    throw new Error("unterminated @media print");
  };

  it("drops the site chrome", () => {
    const block = printBlock();
    // Both are real landmark elements — see PublicHeader and Footer.
    expect(block).toMatch(/\bheader\b/);
    expect(block).toMatch(/\bfooter\b/);
  });

  it("keeps a ticket from splitting across sheets", () => {
    expect(printBlock()).toMatch(/break-inside:\s*avoid/);
  });

  it("forces the QR's quiet zone to print", () => {
    const block = printBlock();
    expect(block).toMatch(/\.qr-plate/);
    expect(block).toMatch(/print-color-adjust:\s*exact/);
  });

  it("tags the plates the rule reaches for", () => {
    // A rule with nothing to match is the quiet way this regresses.
    for (const file of [
      "app/orders/[code]/page.tsx",
      "components/tickets/TicketPreview.tsx",
    ]) {
      expect(readFileSync(join(process.cwd(), file), "utf8")).toContain("qr-plate");
    }
  });
});

/**
 * Persian copy carrying ASCII digits.
 *
 * CLAUDE.md calls Persian-first the most cross-cutting rule in the codebase, and
 * it is the one that degrades silently: nothing breaks, the page just reads in
 * two numeral systems at once. Seat labels escaped it for a whole feature, and
 * the *contrast warning* — of all things — printed «نسبت کنتراست 3.8 از ۴٫۵
 * لازم», an ASCII measurement against a Persian threshold.
 *
 * Literal digits only. Interpolations go through `formatNumber`/`faDigits` and
 * cannot be judged statically, so this is a floor rather than a proof.
 */
describe("Persian copy does not mix numeral systems", () => {
  const PERSIAN = /[\u0600-\u06FF]/;

  /** Codes and identifiers that are ASCII by design, not by omission. */
  const DELIBERATE = [
    /\b[A-Z0-9]{4,8}-\d\b/, // ticket codes — ASCII by design, typed at a door
    /\bIR\d/, //        IBAN examples
    /https?:/,
  ];

  const walk = (dir: string): string[] => {
    const out: string[] = [];
    const visit = (d: string) => {
      for (const name of readdirSync(d)) {
        const p = join(d, name);
        if (statSync(p).isDirectory()) visit(p);
        else if (/\.tsx?$/.test(p)) out.push(p);
      }
    };
    try {
      visit(dir);
    } catch {
      // Absent directory is not a failure.
    }
    return out;
  };

  it("has no Persian string literal with a bare ASCII digit in it", () => {
    const offences: string[] = [];
    for (const dir of ["app", "components", "lib"]) {
      for (const file of walk(join(process.cwd(), dir))) {
        readFileSync(file, "utf8")
          .split("\n")
          .forEach((line, i) => {
            const t = line.trim();
            if (t.startsWith("*") || t.startsWith("//") || t.startsWith("/*")) return;
            for (const m of line.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`\n]*)`/g)) {
              const text = m[1] ?? m[2] ?? m[3] ?? "";
              if (!PERSIAN.test(text) || !/[0-9]/.test(text)) continue;
              // Digits inside an interpolation are formatted at runtime.
              const literal = text.replace(/\$\{[^}]*\}/g, "");
              if (!/[0-9]/.test(literal)) continue;
              if (DELIBERATE.some((re) => re.test(literal))) continue;
              offences.push(
                `${file.replace(process.cwd() + "/", "")}:${i + 1} “${text.slice(0, 60)}”`,
              );
            }
          });
      }
    }
    expect(offences).toEqual([]);
  });
});

/**
 * Touch targets on the controls that are easiest to shrink.
 *
 * WCAG 2.2 SC 2.5.8 asks for 24×24 CSS px. Two controls were under it, both for
 * the same reason: the visual mark *was* the button. The carousel's inactive
 * dot is 6px of ink, and it was therefore a 6×6 tap target on the public events
 * page, on a phone — the smallest thing on screen and the one a thumb is most
 * likely to miss.
 *
 * Source-level, because the failure is structural. A rendered check would need
 * a browser; what actually regressed here is someone collapsing the wrapper
 * back into the mark to save a span.
 */
describe("tap targets stay thumb-sized", () => {
  it("gives the carousel dots a 24px button around a 6px mark", () => {
    const src = readFileSync(
      join(process.cwd(), "components/events/EventsExplorer.tsx"),
      "utf8",
    );
    // The button is the box; the bar is an inner span.
    expect(src).toMatch(/className="grid size-6 place-items-center"/);
    // …and the visual mark must not be the button itself again.
    expect(src).not.toMatch(/aria-label=\{`اسلاید[^}]*\}\s*className=\{cn\(\s*"h-1\.5/);
  });

  it("extends the tag-remove hit area past its 16px chrome", () => {
    // Growing the button would grow the chip, so the target reaches beyond the
    // visual box instead. 16px + 2×6px = 28px.
    const src = readFileSync(
      join(process.cwd(), "components/dashboard/ContactSheet.tsx"),
      "utf8",
    );
    expect(src).toContain("before:-inset-1.5");
    expect(src).toContain("relative");
  });
});

/**
 * The seat list has to scroll inside its card.
 *
 * `SeatList` is the parallel DOM path for the canvas — the only way a screen
 * reader or a keyboard reaches a seat, since `SectionCanvas` is `aria-hidden`.
 * It asked for `h-full` while its card had only a `max-height`, and a
 * percentage height resolves against the parent's *height*, not its cap. So
 * `h-full` computed to `auto`, the `overflow-y-auto` box was never constrained,
 * and a twenty-row section rendered its whole list out through the bottom of
 * the card.
 *
 * Both halves are asserted because either one alone re-breaks it.
 */
describe("the accessible seat list is scrollable, not overflowing", () => {
  it("gives the card a capped flex column", () => {
    const src = readFileSync(
      join(process.cwd(), "components/seatmap/SeatMap.tsx"),
      "utf8",
    );
    expect(src).toMatch(/className="flex max-h-\[420px\] flex-col/);
  });

  it("makes the list a shrinkable flex child rather than a percentage height", () => {
    const src = readFileSync(
      join(process.cwd(), "components/seatmap/SeatList.tsx"),
      "utf8",
    );
    expect(src).toMatch(/className="flex min-h-0 flex-1 flex-col"/);
    expect(src).not.toMatch(/className="flex h-full flex-col"/);
    // And the rows still live in their own scroll box.
    expect(src).toContain("overflow-y-auto");
  });

  it("keeps the canvas out of the accessibility tree, so the list is the path", () => {
    expect(
      readFileSync(join(process.cwd(), "components/seatmap/SectionCanvas.tsx"), "utf8"),
    ).toContain("aria-hidden");
  });
});

/**
 * The typed fallback code.
 *
 * `TicketQr` exists for scanners; this string exists for when a scanner fails,
 * and `app/orders/[code]/page.tsx` says in its own comments that the page is
 * what a buyer prints. It was set in `text-[11px]` — the smallest type anywhere
 * in the product — on the copy that ends up on paper, and *smaller* than the
 * identical token in the wallet at `text-xs`. Paper cannot be zoomed.
 */
describe("the door-fallback token stays legible", () => {
  const orders = () =>
    readFileSync(join(process.cwd(), "app/orders/[code]/page.tsx"), "utf8");
  const wallet = () =>
    readFileSync(join(process.cwd(), "app/me/tickets/page.tsx"), "utf8");
  const css = () => readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

  it("is no smaller on the printed page than in the wallet", () => {
    // Both `text-xs`. The mismatch is the bug, so both halves are asserted.
    expect(orders()).toMatch(/ticket-token[^"]*font-mono text-xs/);
    expect(wallet()).toMatch(/font-mono text-xs/);
    expect(orders()).not.toMatch(/font-mono text-\[11px\]/);
  });

  it("gets larger still on paper, where ink is cheaper than pixels", () => {
    const printBlock = css().slice(css().indexOf("@media print"));
    expect(printBlock).toMatch(/\.ticket-token/);
    expect(printBlock).toMatch(/font-size:\s*14px/);
  });

  it("keeps the class the print rule reaches for", () => {
    // A print rule with nothing to match is the silent way this regresses.
    expect(orders()).toContain("ticket-token");
  });
});

/**
 * What a ticket page says when the network is gone.
 *
 * CLAUDE.md states the requirement — "a ticket must render at a venue door with
 * no signal" — and only half of it holds: `TicketQr` draws the code locally
 * from the token, but the token arrives over `useApi`, so with no signal both
 * ticket pages render «ارتباط با سرور برقرار نشد.» and a retry button.
 *
 * Caching the tokens is a feature with a security question and a cancellation-
 * invalidation question attached. Telling the reader about the fallback that
 * already exists is neither: `resolveHolder` accepts a typed order code, and
 * the confirmation SMS carries it. Retrying is the thing that just failed;
 * saying "read the code out of your SMS" is what gets someone through a door.
 */
describe("the ticket pages name their offline fallback", () => {
  const pages = ["app/me/tickets/page.tsx", "app/orders/[code]/page.tsx"];

  it("gives both ticket pages an offline hint", () => {
    for (const page of pages) {
      const src = readFileSync(join(process.cwd(), page), "utf8");
      expect(src).toContain("offlineHint");
      // It has to point at the SMS, which is where the code actually is.
      expect(src).toMatch(/پیامک/);
    }
  });

  it("shows the hint only for a genuine network failure", () => {
    // A 404 or a 403 is not a signal problem, and telling someone to read their
    // SMS would be nonsense advice for either.
    const src = readFileSync(
      join(process.cwd(), "components/ui/async-state.tsx"),
      "utf8",
    );
    expect(src).toMatch(/offlineHint && error\.code === "NETWORK"/);
  });

  it("keeps the hint optional, so the other pages are unchanged", () => {
    const src = readFileSync(
      join(process.cwd(), "components/ui/async-state.tsx"),
      "utf8",
    );
    expect(src).toMatch(/offlineHint\?: string;/);
  });
});

/**
 * The one place the platform can take money and give nothing.
 *
 * `gateway.verify` is a server-to-server confirmation, so once it returns `ok`
 * the buyer has been charged. `markOrderPaid` was called bare after it: any
 * throw became a 500 for someone who had just paid, with the order left
 * `PENDING_PAYMENT` — which `releaseExpiredOrders` later sweeps to EXPIRED,
 * releasing their seats. Money gone, no ticket, and the trail cleaned up by a
 * background job.
 *
 * It cannot be retried: the callback is a browser redirect, and a buyer who
 * closes the tab never returns.
 */
describe("a charged payment is never lost silently", () => {
  const callback = () =>
    readFileSync(
      join(process.cwd(), "app/api/payments/callback/route.ts"),
      "utf8",
    );

  it("does not verify with the operator before checking the amount", () => {
    // Passing the order total is what stops someone paying 1,000 for a
    // 1,000,000 order; the operator rejects the mismatch.
    expect(callback()).toMatch(/amountToman: order\.total/);
  });

  it("catches a settlement failure instead of throwing at the buyer", () => {
    const src = callback();
    expect(src).toMatch(/try \{[\s\S]*markOrderPaid[\s\S]*\} catch/);
  });

  it("logs the operator's own reference, which is what reconciles it", () => {
    // `refId` is the key against the settlement report. Without it the only
    // record of a charge with no ticket is on the operator's side.
    const src = callback();
    const block = src.slice(src.indexOf("} catch"));
    expect(block).toMatch(/refId: verified\.refId/);
    expect(block).toMatch(/orderId/);
  });

  it("tells the buyer the money arrived rather than «در انتظار پرداخت»", () => {
    const page = readFileSync(
      join(process.cwd(), "app/orders/[code]/page.tsx"),
      "utf8",
    );
    expect(callback()).toMatch(/back\(order\.code, "settling"\)/);
    expect(page).toMatch(/state === "settling"/);
    expect(page).toContain("پرداخت دریافت شد");
  });
});

/**
 * Publishing an event that has nothing to sell.
 *
 * `updateEvent` writes `status: PUBLISHED` unconditionally — there is no check
 * that a ticket type exists, and an organiser may legitimately put a page up
 * before pricing it. What cannot follow is the announcement:
 * `notifyEventPublished` texts «فروش بلیت آغاز شد» while `resolveBuyState`
 * renders the very same event as «فروش هنوز شروع نشده», because there is
 * genuinely nothing on sale.
 *
 * The subscriber was told sales had opened, arrived at a page saying they had
 * not, and could do nothing but subscribe again — with the organiser billed per
 * recipient for it.
 */
describe("a sales announcement needs something on sale", () => {
  it("stays quiet when the event has no ticket type", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/server/notifications/waiting.ts"),
      "utf8",
    );
    expect(src).toMatch(/_count: \{ select: \{ ticketTypes: true \} \}/);
    expect(src).toMatch(/if \(event\._count\.ticketTypes === 0\) return QUIET;/);
  });

  it("keeps every published fixture in a state a buyer can act on", () => {
    // The seed should model coherent events: published, and buyable. A fixture
    // without a ticket type would render «فروش هنوز شروع نشده» forever.
    const src = readFileSync(join(process.cwd(), "prisma/seed-data.ts"), "utf8");
    const withTickets = new Set(
      [...src.matchAll(/eventId: "(3f1a6c2e-[^"]+)"/g)].map((m) => m[1]),
    );
    const unbuyable = [
      ...src.matchAll(/id: "(3f1a6c2e-[^"]+)",\s*\n\s*title: "([^"]+)",[\s\S]*?status: "(\w+)"/g),
    ]
      .filter(([, id, , status]) => status === "published" && !withTickets.has(id))
      .map(([, , title]) => title);

    expect(unbuyable).toEqual([]);
  });
});

/**
 * On-screen copy may not claim what the code cannot deliver.
 *
 * The seam that produced the most real bugs today: an SMS promising a
 * reservation nothing reserved, a check-in hint naming a code format that did
 * not exist, an announcement of sales for an event with nothing on sale. The
 * checkout success screen had two more.
 */
describe("the checkout success screen states only what it knows", () => {
  const src = () =>
    readFileSync(
      join(process.cwd(), "components/checkout/CheckoutForm.tsx"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");

  it("does not assert that a confirmation SMS was sent", () => {
    /**
     * `markOrderPaid` calls `void notifyOrderPaid(row.id)` — the result is
     * discarded before any client could see it, and the whole thing is a no-op
     * when no SMS provider is configured. Past tense was never knowable.
     */
    expect(src()).not.toContain("پیامک تأیید برایتان ارسال شد");
    // What *is* true, and is what the door falls back to.
    expect(src()).toContain("کد پیگیری را نگه دارید");
  });

  it("does not tell a buyer online payment is not built yet", () => {
    // That branch is reached when the gateway *failed to start*, not when it is
    // missing. Saying «به‌زودی فعال می‌شود» sends someone away to wait for a
    // feature that already exists.
    expect(src()).not.toContain("پرداخت آنلاین به‌زودی فعال می‌شود");
  });

  it("warns that an unpaid order does not wait indefinitely", () => {
    // The old wording — "reserved until then" — read as open-ended while the
    // order and its seats expire in minutes.
    expect(src()).toMatch(/مدت کوتاهی/);
  });

  it("keeps the offline hint honest about where the code comes from", () => {
    // It used to say the code is *in the SMS*, which is only true if one was
    // sent. It is also on screen at purchase, which is always true.
    for (const page of ["app/me/tickets/page.tsx", "app/orders/[code]/page.tsx"]) {
      const hint = readFileSync(join(process.cwd(), page), "utf8");
      expect(hint).toMatch(/هنگام خرید و در پیامک تأیید/);
    }
  });
});

/**
 * Cancelling a show when nobody can be told.
 *
 * Eight notifiers open with `if (!smsGateway().configured) return QUIET`, which
 * is right almost everywhere: a missing confirmation SMS is annoying, and
 * blocking a purchase on it would be worse. Cancellation is the exception,
 * because reaching the buyers *is the action* — everything else it does is
 * bookkeeping.
 *
 * `cancellationReach` counted orders and nothing else, and the dialog turned
 * that count into «به ۱٬۲۰۰ خریدار پیامک لغو می‌رود». With no operator
 * credentials the showing is cancelled and not one of them hears about it. The
 * organiser walks away believing their audience was informed; the audience
 * arrives at a door that is not opening.
 */
describe("cancellation says whether it can actually reach anyone", () => {
  it("reports the gateway's state alongside the count", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/server/notifications/show-cancelled.ts"),
      "utf8",
    );
    expect(src).toMatch(/smsConfigured: smsGateway\(\)\.configured/);
    expect(src).toMatch(/smsConfigured: boolean/);
  });

  it("changes what the dialog says, not just what it knows", () => {
    const src = readFileSync(
      join(process.cwd(), "components/dashboard/SessionsManager.tsx"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src).toMatch(/reach\.smsConfigured/);
    // The unconfigured branch has to say the buyers will *not* hear, and that
    // telling them falls to the organiser.
    expect(src).toMatch(/خبردار نمی‌شوند/);
    expect(src).toMatch(/سرویس پیامک پیکربندی نشده است/);
  });
});

/**
 * What a reader sees when a route misses or a render throws.
 *
 * There were no boundaries at all: 31 routes, no `error.tsx`, no
 * `not-found.tsx`, no `global-error.tsx`. Both failures fell through to Next's
 * own screens — «404 | This page could not be found» and «Application error: a
 * client-side exception has occurred» — in English, left-to-right, with no
 * chrome, inside a document declared `lang="fa" dir="rtl"`. That reads less
 * like a missing page than like a broken site.
 */
describe("failure has a Persian page too", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("answers an unmatched address in Persian, with a way onward", () => {
    const src = read("app/not-found.tsx");
    expect(src).toContain("این صفحه پیدا نشد");
    // A dead end is the actual failure; both links go somewhere useful.
    expect(src).toMatch(/href="\/events"/);
    expect(src).toMatch(/href="\/"/);
  });

  it("offers a retry when a render throws, not just an apology", () => {
    const src = read("app/error.tsx");
    expect(src).toMatch(/onClick=\{reset\}/);
    // Most of what throws here is a transient render against half-arrived data.
    expect(src).toContain("تلاش دوباره");
  });

  it("tells a buyer their order survived the crash", () => {
    // The question someone actually has when the ticket page breaks.
    const src = read("app/error.tsx");
    expect(src).toMatch(/سفارش شما ثبت است/);
    expect(src).toMatch(/href="\/me\/tickets"/);
  });

  it("surfaces the digest, which is all a reader can quote", () => {
    // Server errors are redacted before they reach the browser by design; the
    // hash is the only link between their screen and a line in the log.
    expect(read("app/error.tsx")).toMatch(/error\.digest/);
  });

  it("gives the root layout its own net, styled without the stylesheet", () => {
    const src = read("app/global-error.tsx");
    // It replaces the document, so it must supply these itself — and cannot
    // rely on Tailwind, whose stylesheet the broken layout was carrying.
    expect(src).toMatch(/<html lang="fa" dir="rtl">/);
    expect(src).toMatch(/<body/);
    expect(src).not.toMatch(/className=/);
  });
});

/**
 * The chrome has to survive a navigation.
 *
 * Where the header comes from depends on who is reading: `AppShell` wraps a
 * signed-in reader in `AppChrome` — part of the *layout*, so it outlives any
 * `loading.tsx` — and returns bare children to an anonymous one, leaving every
 * page to draw its own `PublicHeader`.
 *
 * So a route-level loading state without the chrome makes the site's header
 * vanish for the length of the navigation, but only for logged-out readers.
 * Those are exactly the routes an anonymous buyer walks, `/orders/[code]`
 * among them — where the payment gateway returns them.
 */
describe("loading states keep the site's chrome", () => {
  it("puts the header and footer in every public loading state", () => {
    const files = [
      "app/loading.tsx",
      "app/events/loading.tsx",
      "app/events/[id]/loading.tsx",
      "app/w/[slug]/loading.tsx",
    ];
    const missing = files.filter((f) => {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      // The *element*, not the identifier — an import left behind after the
      // JSX is deleted would satisfy `includes("PublicHeader")` while the
      // header no longer renders at all.
      return !/<PublicHeader\s*\/>/.test(src) || !/<Footer\s*\/>/.test(src);
    });
    expect(missing).toEqual([]);
  });

  it("leaves the dashboard's own shimmer bare, because its shell persists", () => {
    // `(dashboard)/layout.tsx` renders the sidebar above this, so adding a
    // public header here would stack a second one on top of it.
    const src = readFileSync(
      join(process.cwd(), "app/(dashboard)/loading.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/<PublicHeader\s*\/>/);
  });

  it("still shimmers rather than saying «در حال بارگذاری»", () => {
    // The standing rule: a shape, not a sentence.
    for (const f of ["app/loading.tsx", "app/(dashboard)/loading.tsx"]) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src).toContain("Skeleton");
      expect(src).not.toMatch(/در حال بارگذاری…/);
    }
  });
});
