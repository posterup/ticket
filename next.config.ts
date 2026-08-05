import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * Standalone output bundles the server and only the traced dependencies, so
   * the Docker runtime stage needs no `node_modules` at all.
   *
   * Gated on the build flag rather than always on: Vercel supplies its own
   * output format and does not want this, so only `docker build` sets it.
   */
  output: process.env.DOCKER_BUILD ? "standalone" : undefined,

  /**
   * Pin the file-tracing root to this project. A lockfile sitting in a parent
   * directory otherwise makes Next infer that directory as the workspace root
   * and trace the wrong tree when bundling server output.
   */
  outputFileTracingRoot: process.cwd(),

  /**
   * The platform's front door is explore, not a marketing page: a first-time
   * visitor is here to find something to go to. The organizer pitch lives at
   * `/hosts`.
   *
   * Done here rather than as a page so the hop resolves before any React runs,
   * and `/events` stays the single canonical URL for the explore surface.
   * Temporary (307) on purpose — a permanent redirect gets cached by browsers
   * and is painful to walk back.
   */
  async redirects() {
    return [{ source: "/", destination: "/events", permanent: false }];
  },
};

export default nextConfig;
