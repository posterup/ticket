/**
 * HTTP plumbing for the scraper: one global rate limit, timeouts, retries with
 * exponential backoff, Retry-After support, and structured per-request logs.
 *
 * Conservative by design — we have permission to read these sites, not to
 * hammer them. Native fetch (Node 24); no client library.
 */

const RPS = envNum("SCRAPER_REQUESTS_PER_SECOND", 1);
const TIMEOUT_MS = envNum("SCRAPER_TIMEOUT_MS", 15_000);
const RETRIES = 3;

export function envNum(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export function userAgent(): string {
  return (
    process.env.SCRAPER_USER_AGENT ??
    "PosterUpBot/1.0 (authorized event sync; +https://posterup.example)"
  );
}

/** key=value structured log line. Callers must never pass secrets. */
export function slog(fields: Record<string, unknown>): void {
  const line = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" ");
  console.log(line);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ponytail: one global pacing slot, not per-host buckets — two hosts at 1 rps
// total is still polite; split per-host if syncs ever get slow.
let nextSlot = 0;
async function throttle(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + 1000 / RPS;
  if (at > now) await sleep(at - now);
}

export interface FetchOptions {
  headers?: Record<string, string>;
  method?: string;
  body?: string;
}

/**
 * Fetch with throttle + retry. Retries network errors, timeouts, 429 and 5xx;
 * anything else non-OK throws immediately. Never logs headers (cookies).
 */
export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    await throttle();
    const started = Date.now();
    try {
      const res = await fetch(url, {
        method: options.method ?? "GET",
        body: options.body,
        headers: { "user-agent": userAgent(), ...options.headers },
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      slog({
        stage: "http",
        url,
        status: res.status,
        duration_ms: Date.now() - started,
        attempt,
      });
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} for ${url}`);
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 1000 * 2 ** attempt,
        );
        continue;
      }
      throw new Error(`HTTP ${res.status} for ${url}`);
    } catch (error) {
      if (error instanceof Error && /^HTTP \d+/.test(error.message)) throw error;
      lastError = error;
      slog({
        stage: "http",
        url,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        duration_ms: Date.now() - started,
        attempt,
      });
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`fetch failed for ${url}`);
}

export async function fetchText(
  url: string,
  options?: FetchOptions,
): Promise<string> {
  return (await fetchWithRetry(url, options)).text();
}

export async function fetchJson<T = unknown>(
  url: string,
  options?: FetchOptions,
): Promise<T> {
  return (await fetchWithRetry(url, options)).json() as Promise<T>;
}

/** Run tasks with bounded concurrency, preserving order of results. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await fn(items[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}
