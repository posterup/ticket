/**
 * A placeholder has to occupy the same box as the thing it stands in for.
 *
 * Two failures caused the same symptom — the page visibly re-laying out after
 * it loaded — and both are invisible in review because the two halves live in
 * different files:
 *
 * 1. The `<main>` wrapper differed. `/w/[slug]` shimmered inside `py-10` and
 *    then rendered inside `pb-12`, so the banner dropped 40px and sprang back;
 *    `/events` and `/events/[id]` each had their own smaller version of it. No
 *    amount of care inside the skeleton can compensate for its container being
 *    a different size.
 *
 * 2. The route-level `loading.tsx` and the page's own in-body fallback drew
 *    *different shapes*. These pages fetch on the client, so both run, one
 *    after the other: the route file drew a considered layout, hydration
 *    replaced it with the generic «title, paragraph, box», and the data
 *    replaced that. Two shifts where there should be none.
 *
 * These are string comparisons on purpose. The rule being enforced is literally
 * "these two files must say the same thing", and the moment it is enforced by
 * anything cleverer it stops catching the case where someone edits one file.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

/** Every `className` on a `<main>` in the file. */
function mainClasses(source: string): string[] {
  return [...source.matchAll(/<main[^>]*?className="([^"]+)"/g)].map(
    (m) => m[1],
  );
}

/** Routes whose loading state is promised to match the page. */
const ROUTES = [
  {
    name: "/events",
    loading: "app/events/loading.tsx",
    page: "app/events/page.tsx",
    skeleton: "EventsListSkeleton",
  },
  {
    name: "/events/[id]",
    loading: "app/events/[id]/loading.tsx",
    page: "app/events/[id]/page.tsx",
    skeleton: "EventDetailSkeleton",
  },
  {
    name: "/w/[slug]",
    loading: "app/w/[slug]/loading.tsx",
    page: "app/w/[slug]/page.tsx",
    skeleton: "WorkspaceSkeleton",
  },
] as const;

describe.each(ROUTES)("$name", ({ loading, page, skeleton }) => {
  it("shimmers inside the same <main> the page renders into", () => {
    const [placeholder] = mainClasses(read(loading));
    expect(placeholder).toBeTruthy();

    // The page has two: the `!data` branch and the loaded branch. Both must be
    // the one the route file uses — the first is the second shimmer, and the
    // second is what everything finally settles into.
    const pageMains = mainClasses(read(page));
    expect(pageMains.length).toBeGreaterThan(0);
    for (const cls of pageMains) expect(cls).toBe(placeholder);
  });

  it("draws the same skeleton in the route file and in the page", () => {
    // Not "a skeleton" — the *same* one. Two shapes is two shifts.
    expect(read(loading)).toContain(`<${skeleton} />`);
    expect(read(page)).toContain(`placeholder={<${skeleton} />}`);
  });
});

describe("the fallback loading.tsx", () => {
  it("does not promise a layout it cannot know", () => {
    /*
      `app/loading.tsx` covers every route without a nearer one — the landing
      page, `/pages`, `/feed`, `/me`, `/orders/[code]`, sign-in — whose widths
      run from `max-w-lg` to `max-w-5xl`. It used to draw a six-card grid, which
      is a specific claim about a body it has no way to know, and it was wrong
      on all of them.

      A grid here means someone has taught the generic fallback to imitate one
      particular page again.
    */
    const source = read("app/loading.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(source).not.toMatch(/grid-cols-/);
  });
});
