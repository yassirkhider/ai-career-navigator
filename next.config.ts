import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pdfjs-dist (used by pdf-parse for CV text extraction) dynamically
  // imports a worker script at runtime. Next's bundler doesn't correctly
  // preserve that file path when the package is bundled through
  // webpack/turbopack, causing "Setting up fake worker failed: Cannot
  // find module .../pdf.worker.mjs" at request time. Excluding the
  // package from bundling (serverExternalPackages) fixes the *reference*,
  // but Next's standalone-output file tracer still won't copy the worker
  // file itself, since it's referenced via a dynamically-constructed
  // import path the tracer can't statically follow — so it must be
  // force-included explicitly here too.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  outputFileTracingIncludes: {
    "/api/cv/upload": ["./node_modules/pdfjs-dist/legacy/build/*.mjs"],
  },
};

export default nextConfig;
