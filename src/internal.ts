// Pure helpers shared by `render` (build-time, returns strings) and `inject`
// (runtime, mutates the DOM). Kept dependency-free so the UMD bundle stays
// under the 5KB gzip budget.

import type { AddonConfig, AddonParamValue } from "./types.js";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_URL_RE = /^https?:\/\//i;

export class AddonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AddonError";
  }
}

/**
 * Light, dependency-free shape check for `AddonConfig`. Catches the common
 * mistakes (missing id, wrong injection, non-https src, params with the wrong
 * value type) without pulling Zod into the runtime bundle. The Zod schema in
 * `./manifest.ts` is the source of truth for build-time validation.
 */
export function assertAddonConfig(config: unknown): asserts config is AddonConfig {
  if (!config || typeof config !== "object") {
    throw new AddonError("Add-on config must be an object");
  }
  const c = config as Record<string, unknown>;
  if (typeof c.id !== "string" || !SLUG_RE.test(c.id)) {
    throw new AddonError(`Invalid add-on id (expected kebab-case slug): ${String(c.id)}`);
  }
  if (c.injection !== "script" && c.injection !== "iframe" && c.injection !== "web-component") {
    throw new AddonError(`Invalid injection kind for "${c.id}": ${String(c.injection)}`);
  }
  if (typeof c.src !== "string" || !SAFE_URL_RE.test(c.src)) {
    throw new AddonError(`Invalid src URL for "${c.id}" (must be http(s)): ${String(c.src)}`);
  }
  if (c.params !== undefined && (typeof c.params !== "object" || c.params === null || Array.isArray(c.params))) {
    throw new AddonError(`params must be a plain object on "${c.id}"`);
  }
  if (c.params) {
    for (const [k, v] of Object.entries(c.params as Record<string, unknown>)) {
      const t = typeof v;
      if (t !== "string" && t !== "number" && t !== "boolean") {
        throw new AddonError(`params.${k} on "${c.id}" must be string/number/boolean (got ${t})`);
      }
    }
  }
}

/** `id: "contact-form"` → `shardana-contact-form` */
export function defaultTagFor(id: string): string {
  return `shardana-${id.toLowerCase()}`;
}

/** Convert a param map into kebab-cased `data-*` attribute pairs. */
export function paramsToDataAttrs(params: AddonConfig["params"]): Array<[string, string]> {
  if (!params) return [];
  const out: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(params)) {
    out.push([`data-${camelToKebab(key)}`, stringifyParam(value)]);
  }
  return out;
}

/** Convert a param map into a URL search string (without leading `?`). */
export function paramsToSearch(params: AddonConfig["params"]): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.set(key, stringifyParam(value));
  }
  return search.toString();
}

function camelToKebab(input: string): string {
  return input.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function stringifyParam(value: AddonParamValue): string {
  return typeof value === "boolean" ? (value ? "true" : "false") : String(value);
}

const HTML_ESCAPE_RE = /[&<>"']/g;
const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape attribute values in rendered HTML. */
export function escapeHtml(input: string): string {
  return input.replace(HTML_ESCAPE_RE, (ch) => HTML_ESCAPE_MAP[ch]!);
}

export function buildIframeSrc(src: string, params: AddonConfig["params"]): string {
  const search = paramsToSearch(params);
  if (!search) return src;
  return src.includes("?") ? `${src}&${search}` : `${src}?${search}`;
}

export function isEnabled(config: AddonConfig): boolean {
  return config.enabled !== false;
}

export function resolveHeight(height: AddonConfig["height"]): string {
  if (height === undefined) return "480px";
  return typeof height === "number" ? `${height}px` : height;
}

export function resolveSandbox(sandbox: AddonConfig["sandbox"]): string {
  return sandbox ?? "allow-scripts allow-forms allow-same-origin";
}
