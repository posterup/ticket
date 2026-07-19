/** Persian (Jalali) display formatting for stored Gregorian ISO values. */

export function formatJalaliDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format an integer count/amount with Persian digits and grouping. */
export function formatNumber(n: number): string {
  return n.toLocaleString("fa-IR");
}

/** Format a Toman price; `0` renders as «رایگان» (free). */
export function formatToman(n: number): string {
  return n === 0 ? "رایگان" : `${formatNumber(n)} تومان`;
}
