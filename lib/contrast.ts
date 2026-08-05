/**
 * WCAG contrast arithmetic.
 *
 * Every other colour in the product comes from tokens that were checked once,
 * by hand, and recorded in `docs/design-system.md`. The ticket designer breaks
 * that model: it lets an organiser pick a background and an accent freely, and
 * the body text colour follows a separate light/dark switch. Nothing stops
 * `surface: "light"` — near-black text — over a near-black `bgColor`, which
 * produces a ticket the buyer physically cannot read at a door.
 *
 * A token audit cannot catch that because the colours do not exist until
 * someone types them. So the check has to run where the choice is made.
 *
 * Pure and dependency-free, so it is unit-tested without a DOM.
 */

/** `#rrggbb` → `[r, g, b]`, or `undefined` if it is not one. */
export function parseHex(hex: string): [number, number, number] | undefined {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return undefined;
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const channel = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Contrast ratio between two colours, 1 to 21.
 *
 * Returns `undefined` rather than a fake number when either colour cannot be
 * parsed — a made-up ratio would silently pass or fail a real design.
 */
export function contrastRatio(a: string, b: string): number | undefined {
  const first = parseHex(a);
  const second = parseHex(b);
  if (!first || !second) return undefined;

  const [hi, lo] = [luminance(first), luminance(second)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Composite `fg` at `alpha` over `bg`, both `#rrggbb`. */
export function blend(fg: string, bg: string, alpha: number): string {
  const f = parseHex(fg);
  const b = parseHex(bg);
  if (!f || !b) return bg;
  const mix = f.map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)));
  return `#${mix.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** The two inks a ticket ever prints in. `#171717` matches `text-neutral-900`. */
const INK = { light: "#ffffff", dark: "#171717" } as const;

/**
 * Readable ink for an arbitrary background — whichever of the two wins.
 *
 * `TicketPreview` used to hardcode `text-white` on the accent header and on the
 * category badge, which is fine for all six presets (white clears 5:1 on every
 * one) and indefensible for the seventh option: the designer's accent control
 * is an `<input type="color">`, so an organiser can pick anything. White on
 * `#FFFF00` is **1.07:1**. That is the event title, on the ticket, at the door,
 * possibly in sunlight — and unlike the body text, nothing warned anyone,
 * because the reader never chose white. The code did.
 *
 * Flipping to dark ink rescues exactly the cases white abandons: the same
 * yellow reads at 17.6:1 in `#171717`. Unparseable input keeps white, matching
 * the previous behaviour rather than inventing a new one.
 */
export function inkOn(background: string): string {
  const bg = parseHex(background);
  if (!bg) return INK.light;
  const l = luminance(bg);
  const onLight = (l + 0.05) / (luminance(parseHex(INK.dark)!) + 0.05);
  const onDark = (luminance(parseHex(INK.light)!) + 0.05) / (l + 0.05);
  return onLight >= onDark ? INK.dark : INK.light;
}

/**
 * How far the two softer ranks sit from the solid ink, and the floor they may
 * not sink below.
 *
 * The alpha is the *look*: roughly where `text-white/60` and `text-white/50`
 * already sit, so a ticket on a default body is unchanged. The floor is the
 * *guarantee*, and it is the half that matters, because a fixed alpha cannot
 * give one. Softening by a third is comfortable over white and ruinous over a
 * mid-tone: at the crossover luminance the solid ink is only 4.19:1 to begin
 * with, and 0.68 of it measures **2.44:1** — a rank the fixed number quietly
 * destroyed on exactly the backgrounds `inkOn` could least afford it.
 *
 * So the alpha is a preference and the floor is a constraint. See
 * {@link soften}.
 */
const SECONDARY = {
  muted: { alpha: 0.78, floor: 4.5 },
  label: { alpha: 0.68, floor: 3 },
} as const;

/**
 * Blend `ink` toward `background` by `alpha` — but stop short of `floor`.
 *
 * Contrast rises monotonically with alpha, so the smallest alpha that still
 * clears the floor is found by bisection, and the rank takes whichever of the
 * two alphas is *less* soft. Over white that is the preference (0.68 already
 * measures 5.9:1, far above any floor); over a mid-tone it is the constraint.
 *
 * When even solid ink misses the floor the ink is returned unsoftened. There is
 * nothing better available, and pretending otherwise would hand back a colour
 * that fails the floor while claiming to respect it — the designer's warning
 * grades this same value and is what tells the organiser.
 */
function soften(ink: string, background: string, alpha: number, floor: number): string {
  const solid = contrastRatio(ink, background);
  if (solid === undefined || solid <= floor) return ink;
  if ((contrastRatio(blend(ink, background, alpha), background) ?? 0) >= floor) {
    return blend(ink, background, alpha);
  }
  let lo = alpha; // known to miss the floor
  let hi = 1; //     known to clear it
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    const ratio = contrastRatio(blend(ink, background, mid), background) ?? 0;
    if (ratio >= floor) hi = mid;
    else lo = mid;
  }
  return blend(ink, background, hi);
}

/**
 * The three text ranks a ticket prints, for an arbitrary body colour.
 *
 * `TicketPreview` picks its secondary inks from the light/dark switch alone —
 * `text-faint` on light, `text-white/50` on dark — which is correct for the two
 * default bodies and wrong the moment an organiser sets a custom `bgColor`,
 * because that control does not touch the switch. On a `#999999` body the
 * headline still reads at 6.29:1 while the field labels («دسته», «تاریخ»,
 * «مکان») collapse to **1.81:1**.
 *
 * Worse, the designer's own warning graded only the headline, so it reported
 * that same background as passing. A warning that greenlights a ticket whose
 * labels have vanished is more dangerous than no warning at all — hence
 * {@link inkOn} for the direction and this for the ranks, shared by the preview
 * that renders them and the check that grades them so the two cannot drift.
 */
export function ticketInk(background: string): {
  strong: string;
  muted: string;
  label: string;
} {
  const strong = inkOn(background);
  return {
    strong,
    muted: soften(strong, background, SECONDARY.muted.alpha, SECONDARY.muted.floor),
    label: soften(strong, background, SECONDARY.label.alpha, SECONDARY.label.floor),
  };
}

export type ContrastVerdict = "pass" | "large-only" | "fail";

/**
 * Grade a foreground/background pair.
 *
 * `large-only` is the honest middle: 3:1 clears AA for large text (WCAG 1.4.3)
 * and nothing else, which on a ticket means the event title survives and the
 * seat number does not. Collapsing it into "pass" would bless an unreadable
 * ticket; collapsing it into "fail" would reject a legitimate poster-style
 * design.
 */
export function grade(ratio: number | undefined): ContrastVerdict {
  if (ratio === undefined) return "fail";
  if (ratio >= 4.5) return "pass";
  if (ratio >= 3) return "large-only";
  return "fail";
}
