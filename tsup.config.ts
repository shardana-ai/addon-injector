import { defineConfig } from "tsup";

// Two parallel builds:
//   1. Library build (ESM + CJS + .d.ts) for npm consumers — entries:
//      index, manifest, render. The manifest entry is split out so consumers
//      that only need runtime injection don't pull in Zod.
//   2. UMD build for CDN consumers (unpkg, jsDelivr) — minified, IIFE that
//      assigns to `window.ShardanaAddonInjector`. Excludes the manifest entry
//      to stay under the 5KB gzip budget.
export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      manifest: "src/manifest.ts",
      render: "src/render.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2020",
    treeshake: true,
    splitting: false,
  },
  {
    entry: { "shardana-addon-injector.umd": "src/umd.ts" },
    outDir: "dist/umd",
    format: ["iife"],
    globalName: "ShardanaAddonInjector",
    minify: true,
    sourcemap: true,
    target: "es2018",
    dts: false,
    clean: false,
  },
]);
