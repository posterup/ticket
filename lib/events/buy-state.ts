/**
 * The single sales state an event page shows.
 *
 * Pure, and lifted out of the page so it can be tested without React — the
 * venue document has claimed for a while that it *was* tested this way, and it
 * was not: it lived inside a Server Component with no test at all.
 *
 * Order matters. Each branch answers "why can I not buy this", and the most
 * useful answer wins: a cancelled show beats sold out, which beats a closed
 * sales window.
 */

import { formatJalaliDate, formatNumber, formatToman } from "@/lib/format";
import type { Event, TicketType } from "@/types";

export type BadgeTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

/** How the buy-box action behaves for a given sales state. */
export
type BuyAction =
  | { type: "buy"; label: string }
  | { type: "approval"; label: string }
  | { type: "notify"; label: string }
  | { type: "waitlist"; label: string }
  | { type: "closed"; label: string }
  /**
   * Nothing to do. The box states the situation and offers no control.
   *
   * Distinct from `closed`, which renders a dead button because there *was*
   * something to do and the moment has passed. This one is for states where no
   * action was ever appropriate — a free event, which is a listing rather than
   * something you buy.
   */
  | { type: "none" };

export interface BuyState {
  badge?: { label: string; tone: BadgeTone };
  title: string;
  /** Struck-through original price when `title` is a discounted deal. */
  original?: string;
  subtitle?: string;
  action: BuyAction;
}

const toIso = (ms: number) => new Date(ms).toISOString();

function priceLabel(prices: number[]): string | null {
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === 0 && max === 0) return "رایگان";
  return min === max ? formatToman(min) : `از ${formatToman(min)}`;
}


/**
 * Resolve the single sales state to show for an event, from ticket windows,
 * price, stock, and the approval/waitlist flags.
 */
export function resolveBuyState(event: Event, tickets: TicketType[]): BuyState {
  const now = Date.now();
  const prices = tickets.map((t) => t.price);
  const price = priceLabel(prices);
  const starts = tickets.map((t) => new Date(t.salesStartAt).getTime());
  const ends = tickets.map((t) => new Date(t.salesEndAt).getTime());
  const salesStart = starts.length ? Math.min(...starts) : Infinity;
  const salesEnd = ends.length ? Math.max(...ends) : -Infinity;
  const capacity = tickets.reduce((sum, t) => sum + (t.capacity || 0), 0);
  const sold = tickets.reduce((sum, t) => sum + (t.sold ?? 0), 0);
  const remaining = capacity - sold;

  /**
   * Every showing is off.
   *
   * `resolveBuyState` only ever looked at ticket types, so an event whose
   * سانس‌ها were all cancelled — or all marked «تکمیل ظرفیت» by the organiser —
   * still offered «خرید بلیت». The server refuses every one of them, and the
   * checkout page disables the buttons, so the buyer found out only after
   * clicking through and finding nothing selectable.
   *
   * Checked before stock and windows, because "the show is not happening" is a
   * more useful answer than "the tickets sold out".
   */
  const sessions = event.sessions ?? [];
  const bookable = sessions.filter(
    (s) =>
      !s.cancelled &&
      s.availability !== "full" &&
      s.availability !== "soon",
  );
  if (sessions.length > 0 && bookable.length === 0) {
    const allCancelled = sessions.every((s) => s.cancelled);
    const notYet = sessions.every((s) => s.availability === "soon");

    if (allCancelled) {
      return {
        badge: { label: "لغو شده", tone: "danger" },
        title: "این رویداد برگزار نمی‌شود",
        subtitle: "اگر بلیت خریده‌اید، مبلغ آن بازگردانده می‌شود",
        action: { type: "closed", label: "لغو شده" },
      };
    }
    if (notYet) {
      return {
        badge: { label: "به‌زودی", tone: "neutral" },
        title: "فروش هنوز شروع نشده",
        subtitle: "برای خبردار شدن از آغاز فروش ثبت‌نام کنید",
        action: { type: "notify", label: "خبرم کن" },
      };
    }
    return event.waitlist
      ? {
          badge: { label: "تکمیل ظرفیت", tone: "danger" },
          title: "ظرفیت همهٔ سانس‌ها تکمیل شد",
          subtitle: "برای لیست انتظار ثبت‌نام کنید",
          action: { type: "waitlist", label: "لیست انتظار" },
        }
      : {
          badge: { label: "تکمیل ظرفیت", tone: "danger" },
          title: "ظرفیت همهٔ سانس‌ها تکمیل شد",
          subtitle: "فروش این رویداد بسته است",
          action: { type: "closed", label: "فروش بسته شد" },
        };
  }

  // 2. Sales haven't started (or no tickets yet).
  if (tickets.length === 0 || now < salesStart) {
    return {
      badge: { label: "به‌زودی", tone: "neutral" },
      title: "فروش هنوز شروع نشده",
      subtitle: tickets.length
        ? `شروع فروش: ${formatJalaliDate(toIso(salesStart))}`
        : undefined,
      action: { type: "notify", label: "خبرم کن" },
    };
  }

  // 7 & 8. Sold out — stock exhausted or the sales window has ended.
  const soldOut = (capacity > 0 && remaining <= 0) || now > salesEnd;
  if (soldOut) {
    return event.waitlist
      ? {
          badge: { label: "تکمیل ظرفیت", tone: "danger" },
          title: "بلیت‌ها تمام شد",
          subtitle: "برای لیست انتظار ثبت‌نام کنید",
          action: { type: "waitlist", label: "لیست انتظار" },
        }
      : {
          badge: { label: "تکمیل ظرفیت", tone: "danger" },
          title: "بلیت‌ها تمام شد",
          subtitle: "فروش این رویداد پایان یافت",
          action: { type: "closed", label: "فروش بسته شد" },
        };
  }

  // 4. Registration needs organiser approval.
  if (event.requiresApproval) {
    return {
      badge: { label: "با تأیید میزبان", tone: "accent" },
      title: price ?? "ثبت درخواست",
      subtitle: "پس از تأیید میزبان قطعی می‌شود",
      action: { type: "approval", label: "درخواست ثبت‌نام" },
    };
  }

  /**
   * 1. Free — meaning *every* ticket is, not merely the cheapest one.
   *
   * This asked `Math.min(...prices) === 0`, i.e. whether *any* ticket was free.
   * The dashboard asks the opposite question (`tickets.every((t) => t.price
   * === 0)` in `dashboard/events/[id]/page.tsx`) and that disagreement was the
   * bug: an organiser adding a free «دانشجو» tier beside a paid «عادی» one kept
   * every paid-event tab in their console, while the public page badged the
   * event «رایگان» and promised «بلیت این رویداد رایگان است» above a checkout
   * that then asked for money. Quoting a price of zero for something that costs
   * money is not a labelling slip on a ticketing platform.
   *
   * Mixed events now fall through to the normal on-sale branches, where
   * `priceLabel` says «از ۰ تومان» — the cheapest ticket really is free, and
   * «از» is what makes it a floor rather than the price.
   */
  /*
    A free event is a listing, not a purchase.

    It used to send the visitor to checkout for a «دریافت بلیت» that created an
    order, settled it at zero, and issued a QR — a whole reservation ceremony
    for something nobody reserves. Poster does not sell these; it says what is
    happening and where, and the visitor turns up.

    So: no action. `BuyBox` takes `action` as a node and renders whatever it is
    given, so `none` simply produces no control, and the box becomes the one
    sentence that matters — you do not need a ticket for this.

    Note this is only reached when *every* ticket is free. A mixed free/paid
    event falls through to the on-sale branches below, and a paid order taken to
    zero by a discount code is a different thing entirely: that one still runs
    through checkout, and `createOrder` still settles it immediately.
  */
  if (prices.every((p) => p === 0)) {
    return {
      badge: { label: "رایگان", tone: "success" },
      title: "ورود آزاد",
      subtitle: "برای این رویداد بلیت لازم نیست؛ در زمان اعلام‌شده به محل مراجعه کنید",
      action: { type: "none" },
    };
  }

  // 3. An early-bird ticket is currently on sale.
  const early = tickets.filter(
    (t) =>
      t.category === "early-bird" &&
      new Date(t.salesStartAt).getTime() <= now &&
      now <= new Date(t.salesEndAt).getTime(),
  );
  if (early.length) {
    const earlyEnd = Math.min(
      ...early.map((t) => new Date(t.salesEndAt).getTime()),
    );
    const dealPrice = Math.min(...early.map((t) => t.price));
    const regular = tickets
      .filter((t) => t.category !== "early-bird")
      .map((t) => t.price);
    const fullPrice = regular.length ? Math.min(...regular) : dealPrice;
    return {
      badge: { label: "فروش ویژه", tone: "accent" },
      title: formatToman(dealPrice),
      original:
        fullPrice > dealPrice ? formatToman(fullPrice) : undefined,
      subtitle: `بلیت زودهنگام — تا ${formatJalaliDate(toIso(earlyEnd))}`,
      action: { type: "buy", label: "تهیه بلیت" },
    };
  }

  // 5. Almost done — low remaining stock (≤ 10% of capacity).
  if (capacity > 0 && remaining > 0 && remaining <= Math.max(1, capacity * 0.1)) {
    return {
      badge: { label: "آخرین بلیت‌ها", tone: "warning" },
      title: price ?? "",
      subtitle: `تنها ${formatNumber(remaining)} بلیت باقی مانده`,
      action: { type: "buy", label: "تهیه بلیت" },
    };
  }

  // 6. Normal on-sale.
  return {
    badge: undefined,
    title: price ?? "",
    subtitle: undefined,
    action: { type: "buy", label: "تهیه بلیت" },
  };
}
