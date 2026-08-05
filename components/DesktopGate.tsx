import { Smartphone } from "lucide-react";

/**
 * The whole site, closed on desktop.
 *
 * Poster is built mobile-first — `AppChrome`'s bottom nav, the checkout sheet,
 * the seat picker's touch pan/zoom — and the wide layouts are drafts. Rather
 * than let a laptop visitor walk a half-finished desktop experience and judge
 * the product by it, the desktop viewport gets one honest screen.
 *
 * **CSS, not JavaScript.** The obvious build is a `useEffect` that measures
 * `window.innerWidth`, but that ships the real page first and covers it a beat
 * later — the desktop visitor sees exactly the layout we are trying not to show
 * them, then a flash. `hidden lg:flex` is resolved by the browser before the
 * first paint, so there is no frame in which the page underneath is visible and
 * no hydration to wait for. It also means this stays a Server Component and
 * costs no client bundle at all.
 *
 * **1024px is the line**, matching Tailwind's `lg` — the same breakpoint every
 * layout in the codebase already switches at, so the gate opens exactly where
 * the desktop layouts would have started. Narrowing a desktop window below it
 * therefore does not "bypass" anything: it lands on the mobile layout, which is
 * the layout that works.
 *
 * Scroll on the page behind is stopped by a `body:has([data-desktop-gate])`
 * rule in `globals.css`, so the lock arrives and leaves with this element and
 * excluding a route from the gate needs no second edit.
 */
export function DesktopGate() {
  return (
    <div
      data-desktop-gate
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="desktop-gate-title"
      className="fixed inset-0 z-[200] hidden place-items-center overflow-auto bg-background px-6 py-10 lg:grid"
    >
      <div className="mx-auto max-w-md text-center">
        {/* `--accent-text`, not `--accent`: this is the accent used as ink on a
            light surface, and it is the one verified to clear AA there. */}
        <span className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-subtle text-accent-text">
          <Smartphone className="size-8" aria-hidden />
        </span>
        <h1
          id="desktop-gate-title"
          className="text-2xl font-bold text-foreground"
        >
          نسخهٔ دسکتاپ هنوز آماده نیست
        </h1>
        <p className="mt-3 text-sm leading-loose text-muted">
          پوستر فعلاً فقط روی موبایل در دسترس است. برای دیدن رویدادها و خرید
          بلیت، لطفاً همین نشانی را با گوشی خود باز کنید.
        </p>
        <p className="mt-6 text-xs leading-relaxed text-faint">
          نسخهٔ دسکتاپ در دست ساخت است و به‌زودی منتشر می‌شود.
        </p>
      </div>
    </div>
  );
}
