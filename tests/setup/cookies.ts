import { vi } from "vitest";

/**
 * A cookie store for tests.
 *
 * Route handlers called in-process have no request context, so Next's
 * `cookies()` throws. This replaces it with a jar the test helpers can write
 * to, which is how a suite signs in as a particular user.
 */
const jar = new Map<string, string>();

(globalThis as unknown as { __cookieJar: Map<string, string> }).__cookieJar = jar;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name) } : undefined,
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
  headers: async () => new Headers(),
}));
