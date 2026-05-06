// Core types shared by render-time and runtime entrypoints.
//
// Kept dependency-free (no zod) so the UMD bundle that ships to CDNs stays
// small. Validation lives in `./manifest.ts` and is opt-in.

export type InjectionKind = "script" | "iframe" | "web-component";

export type AddonParamValue = string | number | boolean;

export interface AddonConfig {
  /** Stable id (slug) used as `data-addon-id` and to derive default custom-element tags. */
  id: string;
  /** Set to `false` to skip injection without removing the entry from config. */
  enabled?: boolean;
  /** How the add-on is wired into the page. */
  injection: InjectionKind;
  /** URL of the add-on asset (script source, iframe page, or custom-element bundle). */
  src: string;
  /** Params forwarded as `data-*` attributes (script/web-component) or querystring (iframe). */
  params?: Record<string, AddonParamValue>;
  /**
   * CSS selector of the mount node. Defaults to `document.body` at runtime
   * (or document end for HTML rendering). Ignored by the script-tag injection
   * (script tags can be appended anywhere, default to document end).
   */
  target?: string;
  /**
   * For `injection: "web-component"` — the custom element tag name.
   * Defaults to `shardana-${id}` (kebab-case). Always lowercased.
   */
  tag?: string;
  /**
   * For `injection: "iframe"` — pixel/CSS height. Defaults to `"480px"`.
   * Numeric values are treated as pixels.
   */
  height?: string | number;
  /**
   * For `injection: "iframe"` — sandbox attribute value. Defaults to
   * `"allow-scripts allow-forms allow-same-origin"` which covers form
   * submission widgets without granting top-frame navigation.
   */
  sandbox?: string;
}

export interface ManifestParam {
  type: "string" | "number" | "boolean";
  required?: boolean;
  description?: string;
  default?: AddonParamValue;
  /** For `type: "string"` only — restrict to a fixed list of values. */
  enum?: string[];
}

export interface Manifest {
  /** JSON-Schema-style identifier for the manifest dialect. */
  $schema?: string;
  /** Same id used in plan.yml addons[]. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Semver. */
  version: string;
  /** One-line description. */
  description?: string;
  /** Default injection kind for this add-on. Clients can still override per-instance. */
  injection: InjectionKind;
  /** Default asset URL. Clients can override. */
  src: string;
  /** Declared params: name → constraints. */
  params?: Record<string, ManifestParam>;
  /** Default custom-element tag for `injection: "web-component"`. */
  tag?: string;
  /** Free-form metadata: maintainer, homepage, etc. */
  homepage?: string;
  maintainer?: string;
  license?: string;
}

/** Result of build-time HTML rendering: a string of HTML, or `""` when disabled. */
export type RenderedAddon = string;

/** Result of runtime DOM injection: the elements that were mounted. */
export type InjectedAddon = Element[];
