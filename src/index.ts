// Public API for ESM consumers (`import { injectAddons } from "@shardana/addon-injector"`).
//
// The runtime entrypoints (`render*`, `inject*`) are zero-dep so they can be
// tree-shaken into a tiny bundle. The Zod-backed manifest helpers live behind
// a separate subpath (`@shardana/addon-injector/manifest`) so consumers only
// pay for them when they need build-time validation.

export type {
  AddonConfig,
  AddonParamValue,
  InjectedAddon,
  InjectionKind,
  Manifest,
  ManifestParam,
  RenderedAddon,
} from "./types.js";

export { AddonError } from "./internal.js";
export { renderAddon, renderAddons, type RenderOptions } from "./render.js";
export { injectAddon, injectAddons, type InjectOptions } from "./inject.js";
