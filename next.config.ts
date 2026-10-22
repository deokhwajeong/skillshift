import type { NextConfig } from "next";

/**
 * `npm run build:demo` sets STATIC_EXPORT=1 to build a static copy of the site
 * (plain HTML and JS in out/) for hosting under a path on another site, such as
 * deokhwajeong.github.io/demos/skillshift. A static site has no server, so the
 * Live mode API route is left out (only .tsx files count as routes) and the
 * Live page replays its recorded run instead.
 */
const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  // Partial prerendering cannot run in a static export, so the demo build turns it off.
  cacheComponents: !staticExport,
  partialPrefetching: !staticExport,
  // The Live mode API reads the generated data and config at request time.
  outputFileTracingIncludes: {
    "/api/live": ["./data/generated/**/*", "./config/**/*", "./data/editorial/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(staticExport && {
    output: "export",
    basePath: process.env.BASE_PATH ?? "/demos/skillshift",
    trailingSlash: true,
    pageExtensions: ["tsx"],
  }),
};

export default nextConfig;
