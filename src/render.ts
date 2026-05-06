// Build-time rendering: turn an AddonConfig into a string of HTML that can be
// dropped verbatim into a static page (Astro, server-rendered React, etc.).
// Zero deps so it runs anywhere — Node, Workers, the browser.

import {
  AddonError,
  assertAddonConfig,
  buildIframeSrc,
  defaultTagFor,
  escapeHtml,
  isEnabled,
  paramsToDataAttrs,
  resolveHeight,
  resolveSandbox,
} from "./internal.js";
import type { AddonConfig } from "./types.js";

export interface RenderOptions {
  /** Set to `false` to skip the `assertAddonConfig` shape check. Default `true`. */
  validate?: boolean;
}

/**
 * Render a single add-on as an HTML string. Returns `""` when the add-on is
 * disabled. Throws `AddonError` on invalid input.
 */
export function renderAddon(config: AddonConfig, options: RenderOptions = {}): string {
  if (options.validate !== false) assertAddonConfig(config);
  if (!isEnabled(config)) return "";

  switch (config.injection) {
    case "script":
      return renderScript(config);
    case "iframe":
      return renderIframe(config);
    case "web-component":
      return renderWebComponent(config);
    default:
      throw new AddonError(`Unsupported injection kind: ${(config as AddonConfig).injection}`);
  }
}

/** Render a list of add-ons concatenated by newlines. Disabled entries are skipped. */
export function renderAddons(configs: AddonConfig[], options: RenderOptions = {}): string {
  return configs
    .map((c) => renderAddon(c, options))
    .filter((s) => s.length > 0)
    .join("\n");
}

function renderScript(config: AddonConfig): string {
  const attrs: Array<[string, string]> = [
    ["src", config.src],
    ["data-addon-id", config.id],
    ...paramsToDataAttrs(config.params),
  ];
  // `defer` keeps script execution off the critical path — add-ons should
  // never block the main landing render.
  return `<script ${formatAttrs(attrs)} defer></script>`;
}

function renderIframe(config: AddonConfig): string {
  const src = buildIframeSrc(config.src, config.params);
  const attrs: Array<[string, string]> = [
    ["src", src],
    ["data-addon-id", config.id],
    ["loading", "lazy"],
    ["referrerpolicy", "no-referrer-when-downgrade"],
    ["sandbox", resolveSandbox(config.sandbox)],
    ["title", `Add-on ${config.id}`],
    ["style", `width:100%;border:0;height:${resolveHeight(config.height)};`],
  ];
  return `<iframe ${formatAttrs(attrs)}></iframe>`;
}

function renderWebComponent(config: AddonConfig): string {
  const tag = (config.tag ?? defaultTagFor(config.id)).toLowerCase();
  // The element bundle is loaded once via `<script defer>`. The custom element
  // tag follows on the same line so it's already in the DOM when the bundle
  // runs `customElements.define(...)`.
  const scriptAttrs: Array<[string, string]> = [
    ["src", config.src],
    ["data-addon-id", config.id],
    ["defer", ""],
  ];
  const elAttrs: Array<[string, string]> = [
    ["data-addon-id", config.id],
    ...paramsToDataAttrs(config.params),
  ];
  return `<script ${formatAttrs(scriptAttrs)}></script>\n<${tag} ${formatAttrs(elAttrs)}></${tag}>`;
}

function formatAttrs(attrs: Array<[string, string]>): string {
  return attrs
    .map(([name, value]) => (value === "" ? name : `${name}="${escapeHtml(value)}"`))
    .join(" ");
}
