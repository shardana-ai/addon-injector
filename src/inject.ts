// Runtime DOM injection. Used when the host page wants to mount add-ons after
// the initial render (e.g. SPA pages, dynamic dashboards) — for static
// Astro/SSR landings prefer `renderAddon` from `./render.js`.

import {
  AddonError,
  assertAddonConfig,
  buildIframeSrc,
  defaultTagFor,
  isEnabled,
  paramsToDataAttrs,
  resolveHeight,
  resolveSandbox,
} from "./internal.js";
import type { AddonConfig, InjectedAddon } from "./types.js";

export interface InjectOptions {
  /** Where to mount the add-on. Defaults to `document.body`. */
  target?: ParentNode;
  /** Pass `false` to skip the shape check. Default `true`. */
  validate?: boolean;
  /** Custom document, useful for testing. Defaults to `globalThis.document`. */
  document?: Document;
}

/**
 * Inject a single add-on into the DOM. Returns the elements that were
 * appended. Returns `[]` when the add-on is disabled.
 */
export function injectAddon(config: AddonConfig, options: InjectOptions = {}): InjectedAddon {
  if (options.validate !== false) assertAddonConfig(config);
  if (!isEnabled(config)) return [];

  const doc = options.document ?? globalThis.document;
  if (!doc) throw new AddonError("No document available — pass `options.document` for non-browser environments");

  const target = resolveTarget(config, options, doc);
  const elements = createElements(config, doc);
  for (const el of elements) target.appendChild(el);
  return elements;
}

/** Inject every add-on in `configs`. Returns the flat list of mounted elements. */
export function injectAddons(configs: AddonConfig[], options: InjectOptions = {}): InjectedAddon {
  const out: Element[] = [];
  for (const config of configs) {
    out.push(...injectAddon(config, options));
  }
  return out;
}

function resolveTarget(config: AddonConfig, options: InjectOptions, doc: Document): ParentNode {
  if (options.target) return options.target;
  if (config.target) {
    const node = doc.querySelector(config.target);
    if (!node) throw new AddonError(`target selector did not match for "${config.id}": ${config.target}`);
    return node;
  }
  return doc.body;
}

function createElements(config: AddonConfig, doc: Document): Element[] {
  switch (config.injection) {
    case "script":
      return [createScript(config, doc)];
    case "iframe":
      return [createIframe(config, doc)];
    case "web-component":
      return createWebComponent(config, doc);
    default:
      throw new AddonError(`Unsupported injection kind: ${(config as AddonConfig).injection}`);
  }
}

function createScript(config: AddonConfig, doc: Document): HTMLScriptElement {
  const script = doc.createElement("script");
  script.src = config.src;
  script.defer = true;
  script.setAttribute("data-addon-id", config.id);
  for (const [name, value] of paramsToDataAttrs(config.params)) {
    script.setAttribute(name, value);
  }
  return script;
}

function createIframe(config: AddonConfig, doc: Document): HTMLIFrameElement {
  const iframe = doc.createElement("iframe");
  iframe.src = buildIframeSrc(config.src, config.params);
  iframe.setAttribute("data-addon-id", config.id);
  iframe.setAttribute("loading", "lazy");
  iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
  iframe.setAttribute("sandbox", resolveSandbox(config.sandbox));
  iframe.title = `Add-on ${config.id}`;
  iframe.style.width = "100%";
  iframe.style.border = "0";
  iframe.style.height = resolveHeight(config.height);
  return iframe;
}

function createWebComponent(config: AddonConfig, doc: Document): Element[] {
  const tag = (config.tag ?? defaultTagFor(config.id)).toLowerCase();
  const script = doc.createElement("script");
  script.src = config.src;
  script.defer = true;
  script.setAttribute("data-addon-id", config.id);

  const element = doc.createElement(tag);
  element.setAttribute("data-addon-id", config.id);
  for (const [name, value] of paramsToDataAttrs(config.params)) {
    element.setAttribute(name, value);
  }
  return [script, element];
}
