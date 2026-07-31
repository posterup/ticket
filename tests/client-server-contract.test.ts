/**
 * The client and the route have to agree.
 *
 * Moving `/orders/:id/pay` to read its phone from the body was verified against
 * the route, against the tests, and with a grep for `searchParams.get("phone")`
 * — and it still shipped broken, because the *checkout page* was still sending
 * `?phone=`. Guest checkout, the primary purchase path, 403'd at payment.
 *
 * Every one of those checks looked at the server. None looked at the caller.
 * This reads the client source instead: no browser, no server, just the strings
 * the pages actually build.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      // Route handlers are the server side of this contract, not the caller.
      if (entry === "api" || entry === "node_modules") continue;
      out.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

const files = [...sourceFiles("app"), ...sourceFiles("components")];

/** Every `/api/...` URL a client builds, with the file it came from. */
const calls = files.flatMap((file) => {
  const src = readFileSync(file, "utf8");
  return [...src.matchAll(/["'`](\/api\/[^"'`]*)["'`]/g)].map((m) => ({
    file,
    url: m[1],
  }));
});

/**
 * Values that must never travel in a URL: they are written to the access log,
 * kept in browser history, and sent to third parties in `Referer`. Several of
 * them are the credential standing in for a session on a guest order.
 */
const SENSITIVE = ["phone", "token", "qrToken", "iban", "email", "code"];

describe("what the client sends", () => {
  it("finds the API calls to check", () => {
    expect(calls.length).toBeGreaterThan(10);
  });

  it("never puts a sensitive value in a query string", () => {
    const offenders = calls.filter(({ url }) => {
      const query = url.split("?")[1];
      if (!query) return false;
      return SENSITIVE.some((key) =>
        new RegExp(`(^|&)${key}=`, "i").test(query),
      );
    });
    expect(
      offenders.map((o) => `${o.file}: ${o.url}`),
      "move these into the request body, or a header for a GET",
    ).toEqual([]);
  });

  it("keeps the order-payment call free of a query string entirely", () => {
    // The specific regression: `?phone=` here silently broke guest checkout,
    // because the route had moved to reading the body and nothing compared the
    // two.
    const pay = calls.filter((c) => /\/api\/orders\/.*\/pay/.test(c.url));
    expect(pay.length).toBeGreaterThan(0);
    for (const c of pay) expect(c.url, c.file).not.toContain("?");
  });

  it("keeps the cancel call free of one too", () => {
    const cancel = calls.filter((c) => /\/api\/orders\/.*\/cancel/.test(c.url));
    for (const c of cancel) expect(c.url, c.file).not.toContain("?");
  });
});

/** Route files, and which HTTP methods each exports. */
function routeTable(): Map<string, Set<string>> {
  const table = new Map<string, Set<string>>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry === "route.ts") {
        const key = "/" + dir.replace(/^app\//, "");
        const methods = new Set(
          [...readFileSync(path, "utf8").matchAll(
            /export const (GET|POST|PATCH|PUT|DELETE)\b/g,
          )].map((m) => m[1]),
        );
        table.set(key, methods);
      }
    }
  };
  walk("app/api");
  return table;
}

const ROUTES = routeTable();

/** `[id]` and `[...rest]` become path matchers. */
function matches(route: string, url: string): boolean {
  const pattern =
    "^" +
    route
      .replace(/\[\.\.\.[^\]]+\]/g, ".+")
      .replace(/\[[^\]]+\]/g, "[^/]+") +
    "$";
  return new RegExp(pattern).test(url);
}

/** Every client call, with the method it uses. */
const requests = files.flatMap((file) => {
  const src = readFileSync(file, "utf8");
  return [
    ...src.matchAll(
      /(?:fetch|apiFetch)(?:<[^>]*>)?\(\s*[`"']([^`"']*?\/api\/[^`"']*)[`"']([^;]{0,220})/gs,
    ),
  ].map((m) => ({
    file,
    // A template hole is one path segment.
    url: m[1].replace(/\$\{[^}]*\}/g, "X").split("?")[0].replace(/\/$/, ""),
    method: /method:\s*"(\w+)"/.exec(m[2])?.[1] ?? "GET",
  }));
});

describe("what the client calls", () => {
  it("finds the requests to check", () => {
    expect(requests.length).toBeGreaterThan(10);
    expect(ROUTES.size).toBeGreaterThan(20);
  });

  it("only calls routes that exist", () => {
    const orphans = requests.filter(
      (r) => ![...ROUTES.keys()].some((route) => matches(route, r.url)),
    );
    expect(orphans.map((o) => `${o.file}: ${o.method} ${o.url}`)).toEqual([]);
  });

  it("only uses methods those routes export", () => {
    const wrong = requests.filter((r) => {
      const route = [...ROUTES.keys()].find((k) => matches(k, r.url));
      return route !== undefined && !ROUTES.get(route)!.has(r.method);
    });
    // A page calling POST on a GET-only handler is a 405 nobody tested for.
    expect(
      wrong.map((w) => {
        const route = [...ROUTES.keys()].find((k) => matches(k, w.url))!;
        return `${w.file}: ${w.method} ${w.url} (exports ${[...ROUTES.get(route)!].sort()})`;
      }),
    ).toEqual([]);
  });
});
