// UMD entry — exposes the runtime injection helpers on
// `window.ShardanaAddonInjector` for users who load the bundle from a CDN
// (`<script src="https://unpkg.com/@shardana/addon-injector"></script>`).
//
// Deliberately omits the manifest helpers (Zod) so the gzip budget stays
// under 5KB.

export { renderAddon, renderAddons } from "./render.js";
export { injectAddon, injectAddons } from "./inject.js";
export { AddonError } from "./internal.js";
