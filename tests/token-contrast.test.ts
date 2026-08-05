/**
 * Every token text/surface pair the user-facing code actually uses, graded.
 *
 * `docs/design-system.md` records ratios that were checked once, by hand. That
 * catches the pairs someone thought to check; it cannot catch the pair a new
 * component invents next week. This walks the source instead, so the audit is
 * of what is on screen rather than of what was written down.
 *
 * **The unit is one string literal.** An earlier version of this pairing
 * scanned whole `className={cn(…)}` calls and produced fourteen confident
 * failures, every one of them false: a ternary puts both branches in the same
 * call, so it was grading `text-foreground` against the `bg-foreground` of the
 * branch where the text is `text-background`. Classes only truly land together
 * when they are written together, hence the literal-by-literal scan below.
 *
 * What this deliberately cannot see: text that inherits its background from an
 * ancestor element, which is most text in the product. It is a floor, not a
 * proof — the three real contrast bugs found in this area were all in places
 * tokens do not reach at all (a canvas, and an organiser's own colour picker).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

import { blend, contrastRatio, grade } from "@/lib/contrast";

/**
 * Token values, read from the stylesheet rather than copied.
 *
 * A copy would let the test keep passing after someone darkens a token — which
 * is the exact regression it exists to catch.
 */
function readTokens(): Record<string, string> {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/^\s*--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/gm)) {
    out[m[1]] = m[2].toLowerCase();
  }
  // `--card` is a white glass over the page; flatten it the way a browser does
  // so it can be compared like any other surface.
  const alpha = /--card:\s*rgba\(255,\s*255,\s*255,\s*([\d.]+)\)/.exec(css);
  if (alpha && out.background) {
    out.card = blend("#ffffff", out.background, Number(alpha[1]));
  }
  out.white = "#ffffff";
  return out;
}

/** Tailwind's `text-*`/`bg-*` names that are not tokens, so cannot be graded. */
const NOT_A_TOKEN = /^(xs|sm|base|lg|xl|\dxl|left|right|center|start|end|balance|pretty|wrap|nowrap|clip|ellipsis|transparent|current|inherit|top|bottom|clip-text|gradient-.*)$/;

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".tsx")) out.push(p);
    }
  };
  try {
    walk(dir);
  } catch {
    // A surface that has not been built yet is not a failure.
  }
  return out;
}

const SURFACES = [
  "components/checkout",
  "components/events",
  "components/seatmap",
  "components/tickets",
  "components/ui",
  "app/events",
  "app/orders",
  "app/me",
  "app/w",
];

interface Pair {
  text: string;
  bg: string;
  where: string;
  snippet: string;
}

function collectPairs(tokens: Record<string, string>): Pair[] {
  const seen = new Map<string, Pair>();
  for (const dir of SURFACES) {
    for (const file of tsxFiles(join(process.cwd(), dir))) {
      const src = readFileSync(file, "utf8");
      for (const lit of src.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`\n]*)`/g)) {
        const cls = lit[1] ?? lit[2] ?? lit[3] ?? "";
        if (!/\b(?:text|bg)-/.test(cls)) continue;
        // `(?!\/)` drops opacity variants like `text-white/60`: the rendered
        // colour depends on what is behind it, which a static pass cannot know.
        const texts = [...cls.matchAll(/\btext-([a-z-]+)\b(?!\/)/g)].map((m) => m[1]);
        const bgs = [...cls.matchAll(/\bbg-([a-z-]+)\b(?!\/)/g)].map((m) => m[1]);
        for (const text of texts) {
          for (const bg of bgs) {
            if (NOT_A_TOKEN.test(text) || NOT_A_TOKEN.test(bg)) continue;
            if (!tokens[text] || !tokens[bg]) continue;
            const key = `${text}|${bg}`;
            if (!seen.has(key)) {
              seen.set(key, {
                text,
                bg,
                where: file.replace(process.cwd() + "/", ""),
                snippet: cls.trim().slice(0, 60),
              });
            }
          }
        }
      }
    }
  }
  return [...seen.values()];
}

/**
 * The venue overview's section captions.
 *
 * Graded separately because nothing about them is a plain token pair: the text
 * sits on an SVG fill painted at `fillOpacity`, over the card, and it is that
 * *composite* — not the section colour — that decides whether the name is
 * readable. The pair scan above cannot see it, and the bug it hides is the one
 * that mattered most: the primary navigation of the seat map at 2.85:1.
 *
 * The opacities are read out of the component so that changing them there,
 * without re-checking, fails here.
 */
describe("venue overview section captions", () => {
  const tokens = readTokens();
  const src = readFileSync(
    join(process.cwd(), "components/seatmap/VenueOverview.tsx"),
    "utf8",
  );

  /** The five colours the seeded theatre and arena actually author. */
  const PALETTE = ["#e10e7c", "#1b6df5", "#8553f6", "#08865c", "#a76607"];

  function opacities(): { selected: number; unselected: number; soldOut: number } {
    const fill = /fillOpacity=\{isSelected \? ([\d.]+) : ([\d.]+)\}/.exec(src);
    const sold = /soldOut && "opacity-(\d+)"/.exec(src);
    if (!fill || !sold) throw new Error("VenueOverview opacities moved — re-read them");
    return {
      selected: Number(fill[1]),
      unselected: Number(fill[2]),
      soldOut: Number(fill[2]) * (Number(sold[1]) / 100),
    };
  }

  /** The token the captions are painted in, read from the class name. */
  function captionInk(): string {
    const m = /className="pointer-events-none fill-([a-z-]+) text-\[22px\]/.exec(src);
    if (!m) throw new Error("caption class moved — re-read it");
    return tokens[m[1]] ?? m[1];
  }

  it("keeps every caption state above the large-text bar", () => {
    const card = tokens.card;
    const ink = captionInk();
    const states = opacities();

    const failures: string[] = [];
    for (const colour of PALETTE) {
      for (const [name, alpha] of Object.entries(states)) {
        const fill = blend(colour, card, alpha);
        const ratio = contrastRatio(ink, fill)!;
        if (ratio < 3) failures.push(`${name} ${colour}: ${ratio.toFixed(2)}:1`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("keeps the state a buyer actually reads at full AA", () => {
    // Unselected is the resting state of the map — every section, all the time.
    // It was 2.85–3.40:1 in white; nothing here may take it back below 4.5.
    const { unselected } = opacities();
    const worst = Math.min(
      ...PALETTE.map(
        (c) => contrastRatio(captionInk(), blend(c, tokens.card, unselected))!,
      ),
    );
    expect(worst).toBeGreaterThanOrEqual(4.5);
  });
});

describe("token contrast across the user-facing surfaces", () => {
  const tokens = readTokens();
  const pairs = collectPairs(tokens);

  it("finds pairs to grade at all", () => {
    // Guards the instrument, not the design: a regex that silently stops
    // matching would otherwise report a clean sweep of nothing.
    expect(tokens.foreground).toBe("#14101f");
    expect(pairs.length).toBeGreaterThan(8);
  });

  it("never puts token text on a token surface below AA", () => {
    const failures = pairs
      .map((p) => ({ ...p, ratio: contrastRatio(tokens[p.text], tokens[p.bg])! }))
      .filter((p) => grade(p.ratio) !== "pass")
      .map(
        (p) =>
          `text-${p.text} on bg-${p.bg} = ${p.ratio.toFixed(2)}:1 — ${p.where} “${p.snippet}”`,
      );

    expect(failures).toEqual([]);
  });

  /**
   * The pairs the scan above deliberately drops.
   *
   * `text-x on bg-y/40` is a token pair only after compositing, and every real
   * contrast bug found in this area lived in exactly that gap — a canvas, an
   * SVG `fillOpacity`, a `<input type="color">`. Skipping them because they are
   * awkward to resolve is skipping the part that breaks.
   *
   * Composited over both the page and a card, because a tinted panel appears on
   * both and the card is the lighter, less forgiving of the two.
   */
  it("keeps opacity-tinted panels above AA on the page and on a card", () => {
    const page = tokens.background;
    const card = tokens.card;
    const failures: string[] = [];

    for (const dir of SURFACES.concat(["components/dashboard", "components/create", "components/finance"])) {
      for (const file of tsxFiles(join(process.cwd(), dir))) {
        for (const lit of readFileSync(file, "utf8").matchAll(/"([^"\n]*)"/g)) {
          const cls = lit[1];
          const bg = /\bbg-([a-z-]+)\/(\d+)\b/.exec(cls);
          const text = /\btext-([a-z-]+)\b(?!\/)/.exec(cls);
          if (!bg || !text || !tokens[bg[1]] || !tokens[text[1]]) continue;
          // Icons and other graphical objects need 3:1, not 4.5:1 — a scrim
          // over a thumbnail is not body text and grading it as such would
          // force a darkness the design does not need.
          const graphical = /\bsize-\d|place-items-center\b/.test(cls) && !/text-(xs|sm|base|lg)\b/.test(cls);
          const floor = graphical ? 3 : 4.5;

          for (const [base, name] of [[page, "page"], [card, "card"]] as const) {
            const fill = blend(tokens[bg[1]], base, Number(bg[2]) / 100);
            const ratio = contrastRatio(tokens[text[1]], fill)!;
            if (ratio < floor) {
              failures.push(
                `text-${text[1]} on bg-${bg[1]}/${bg[2]} over ${name} = ${ratio.toFixed(2)}:1 (needs ${floor}) — ${file.replace(process.cwd() + "/", "")}`,
              );
            }
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("keeps a record of how little headroom the tightest pair has", () => {
    const worst = pairs
      .map((p) => contrastRatio(tokens[p.text], tokens[p.bg])!)
      .sort((a, b) => a - b)[0];

    /**
     * `--accent-text` on `--accent-soft` sits at 4.52:1 — two hundredths above
     * the threshold, and deliberately so: `globals.css` documents that token as
     * "AA on --background and --accent-soft", i.e. tuned to exactly this edge.
     *
     * Asserted as a range rather than a floor so that *raising* it trips too.
     * A comfortable margin appearing here would mean someone changed a token
     * and did not know this pairing was riding on it.
     */
    expect(worst).toBeGreaterThanOrEqual(4.5);
    expect(worst).toBeLessThan(4.7);
  });
});

/**
 * Focus indicators.
 *
 * WCAG 2.2 SC 1.4.11 asks for 3:1 against whatever the ring is drawn over — and
 * `ring-2` paints *outside* the border box, so that is the surrounding surface,
 * not the element's own background.
 *
 * `focus-visible:ring-ring/40` was the house pattern at 58 call sites and met
 * that bar nowhere: 1.97:1 on the page, 1.98:1 on a card, 1.92:1 on `--subtle`,
 * 1.53:1 on `--foreground`. Keyboard focus was, in practice, invisible
 * everywhere — and at every one of those sites the ring was the *only* focus
 * cue, with no border or background change to fall back on.
 *
 * A softer ring is still fine where something else carries the signal: the form
 * fields pair `ring-ring/15` with `focus-visible:border-foreground`, which is a
 * 17:1 border change. The rule below is therefore about *lone* rings, not about
 * opacity as such.
 */
describe("focus indicators are actually visible", () => {
  const tokens = readTokens();

  it("keeps a lone focus ring above 3:1 on every surface it can land on", () => {
    const ring = tokens.ring;
    const surfaces = ["background", "card", "subtle", "foreground"] as const;

    const failures: string[] = [];
    for (const dir of SURFACES.concat([
      "components/dashboard",
      "components/create",
      "components/finance",
      "app/(dashboard)",
    ])) {
      for (const file of tsxFiles(join(process.cwd(), dir))) {
        readFileSync(file, "utf8")
          .split("\n")
          .forEach((line, i) => {
            const m = /focus-visible:ring-ring\/(\d+)/.exec(line);
            if (!m) return;
            // A second cue means the ring is decoration, not the indicator.
            if (/focus-visible:(border|bg|text|outline)-/.test(line)) return;
            const alpha = Number(m[1]) / 100;
            for (const s of surfaces) {
              const painted = blend(ring, tokens[s], alpha);
              const ratio = contrastRatio(painted, tokens[s])!;
              if (ratio < 3) {
                failures.push(
                  `${file.replace(process.cwd() + "/", "")}:${i + 1} ring/${m[1]} on --${s} = ${ratio.toFixed(2)}:1`,
                );
              }
            }
          });
      }
    }
    expect(failures).toEqual([]);
  });

  it("leaves no interactive element with outline-none and nothing put back", () => {
    const offences: string[] = [];
    for (const dir of SURFACES.concat(["components/dashboard", "components/create"])) {
      for (const file of tsxFiles(join(process.cwd(), dir))) {
        /**
         * The whole `className` expression, not one literal.
         *
         * Unlike the contrast pairing above, `cn("outline-none", "focus-visible:…")`
         * applies *both* — they are arguments, not branches. Scanning literal by
         * literal reported the form primitives as bare when their focus border
         * simply lives on the next line.
         */
        const src = readFileSync(file, "utf8");
        for (const m of src.matchAll(/className=(?:"([^"\n]*)"|\{cn\(([\s\S]*?)\n\s*\)\})/g)) {
          const cls = m[1] ?? m[2] ?? "";
          if (!/\boutline-none\b/.test(cls)) continue;
          if (/focus-visible:|focus:|ring-|outline-\[|outline-\d/.test(cls)) continue;
          offences.push(
            `${file.replace(process.cwd() + "/", "")} “${cls.replace(/\s+/g, " ").slice(0, 60)}”`,
          );
        }
      }
    }
    expect(offences).toEqual([]);
  });
});

/**
 * Which pages may call an endpoint that can answer 401.
 *
 * `apiFetch` now treats `UNAUTHENTICATED` as a navigation: it clears the dead
 * cookie and sends the reader to `/login`. That is right where a session was
 * expected and badly wrong anywhere else — a public page calling an
 * authenticated endpoint would sign out, or redirect away, a visitor who had
 * simply arrived.
 *
 * It holds today by three separate decisions, none of them written down:
 * `/api/auth/me` answers 200 with nulls rather than 401, every `/api/me/*`
 * caller sits under a route `middleware.ts` protects, and `FollowPages` passes
 * `null` to `useApi` until it knows there is a user. Losing any one of them
 * reintroduces the bug, so the invariant is asserted rather than assumed.
 */
describe("only protected pages call endpoints that can 401", () => {
  /** Mirrors `PROTECTED` in `middleware.ts`. */
  const PROTECTED = ["/dashboard", "/me", "/feed", "/tickets/create", "/admin"];

  it("keeps every unconditional authenticated call behind the middleware", () => {
    const offenders: string[] = [];
    for (const file of tsxFiles(join(process.cwd(), "app"))) {
      const rel = file
        .replace(process.cwd() + "/app", "")
        .replace(/\/(page|layout|template)\.tsx$/, "");
      // Route groups like `(dashboard)` are not part of the URL…
      const route = rel.replace(/\/\([^)]*\)/g, "") || "/";
      // …but they *are* how a layout declares what it wraps. `(dashboard)/
      // layout.tsx` has no route of its own and is nonetheless only ever
      // rendered beneath `/dashboard`, so the group name is what says so.
      const segments = rel.split("/").map((seg) => seg.replace(/^\(|\)$/g, ""));
      const covered =
        PROTECTED.some((p) => route.startsWith(p)) ||
        PROTECTED.some((p) => segments.includes(p.slice(1)));
      if (covered) continue;

      const src = readFileSync(file, "utf8");
      // A literal path — a conditional one (`cond ? "/api/me/x" : null`) is the
      // documented way to ask only when signed in, and does not match this.
      for (const m of src.matchAll(/useApi<[^>]*>\(\s*"(\/api\/(?:me|admin)\/[^"]*)"/g)) {
        offenders.push(`${route} → ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the sign-in probe answering 200 for a stranger", () => {
    // If this ever throws `UNAUTHENTICATED`, every anonymous visitor to the
    // landing page is bounced to /login by `apiFetch`.
    const src = readFileSync(
      join(process.cwd(), "app/api/auth/me/route.ts"),
      "utf8",
    );
    expect(src).toMatch(/user: null, memberships: \[\]/);
    expect(src).not.toMatch(/requireUser|UNAUTHENTICATED/);
  });

  it("still skips the request entirely for a null path", () => {
    // What makes the conditional form safe rather than merely tidy.
    const src = readFileSync(join(process.cwd(), "lib/client/api.ts"), "utf8");
    expect(src).toMatch(/if \(path === null\) \{/);
  });
});
