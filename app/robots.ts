import type { MetadataRoute } from "next";

/**
 * Generates /robots.txt. The whole project is disallowed for every crawler so
 * nothing is indexed. Note that robots.txt only blocks *crawling* — the global
 * `robots: { index: false }` metadata in the root layout is what actually keeps
 * pages out of the index if a URL is discovered elsewhere.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
