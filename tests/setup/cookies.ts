import { afterAll, vi } from "vitest";

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

/**
 * Every session a file minted, removed when it finishes.
 *
 * `signInAs` writes a real `Session` row and most suites never sign out, so the
 * table grew by roughly eighty rows per full run — unnoticed, because `Session`
 * was not among the tables the drift check watched. This runs per test file,
 * which is the only scope that reliably sees the same module instance as the
 * helpers that did the minting.
 */
afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const { dropMintedSessions } = await import("../api/helpers");
  await dropMintedSessions();
});
