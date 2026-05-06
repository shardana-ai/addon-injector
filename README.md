# @shardana/addon-injector

[![npm](https://img.shields.io/npm/v/@shardana/addon-injector.svg)](https://www.npmjs.com/package/@shardana/addon-injector)
[![license](https://img.shields.io/npm/l/@shardana/addon-injector.svg)](./LICENSE)

Inject **Heroic Landing add-ons** (script, iframe, or web-component) into a
page from a single declarative config. Two modes:

- **Build-time HTML rendering** — `renderAddon` / `renderAddons` return
  strings you can embed in a static HTML page (Astro, server-rendered React,
  plain `index.html`).
- **Runtime DOM injection** — `injectAddon` / `injectAddons` mount the
  add-ons by mutating `document` (SPA pages, dashboards, dynamic mounts).

The library is dependency-free at runtime. The opt-in **manifest**
sub-entry validates an add-on author's `addon-manifest.json` against a Zod
schema, so the build pipeline can fail fast on a misconfigured `plan.yml`.

The UMD bundle ships under **5 KB gzipped** so dropping it on a CDN does
not regress LCP / TBT.

---

## What is a "Heroic add-on"?

A Heroic add-on is a third-party widget — contact form, booking iframe,
review carousel — that can be enabled per-customer in a Heroic landing
without changing the template code. Each add-on:

1. Lives in its own repository (e.g.
   [`shardana-ai/addon-contact-form`](https://github.com/shardana-ai/addon-contact-form)).
2. Publishes an `addon-manifest.json` declaring its **id**, default URL,
   injection mode (`script` / `iframe` / `web-component`) and accepted
   params.
3. Gets enabled by adding an entry under `plan.yml → addons`.

`@shardana/addon-injector` is the glue: it validates the config against
the manifest and renders or mounts the widget.

---

## Installation

```bash
npm install @shardana/addon-injector
# or
pnpm add @shardana/addon-injector
# or
yarn add @shardana/addon-injector
```

CDN (UMD, exposes `window.ShardanaAddonInjector`):

```html
<script src="https://unpkg.com/@shardana/addon-injector"></script>
<script>
  ShardanaAddonInjector.injectAddons([
    {
      id: "contact-form",
      injection: "script",
      src: "https://forms.shardana.ai/v1/widget.js",
      params: { formId: "da-mario", submitUrl: "https://forms.shardana.ai/v1/submit" },
    },
  ]);
</script>
```

---

## Quick start — build-time rendering

Use this in Astro/Next/SSR templates. `renderAddons` returns an HTML
string you embed verbatim in the page.

```ts
import { renderAddons } from "@shardana/addon-injector/render";

const html = renderAddons([
  {
    id: "contact-form",
    injection: "script",
    src: "https://forms.shardana.ai/v1/widget.js",
    params: { formId: "da-mario" },
  },
  {
    id: "booking",
    injection: "iframe",
    src: "https://book.example.com/widget",
    params: { theme: "light" },
    height: 600,
  },
]);
```

In an Astro component:

```astro
---
import { renderAddons } from "@shardana/addon-injector/render";
import type { AddonConfig } from "@shardana/addon-injector";

interface Props { addons: AddonConfig[] }
const { addons } = Astro.props;
const html = addons.length > 0 ? renderAddons(addons) : "";
---
{html && <Fragment set:html={html} />}
```

Disabled entries (`enabled: false`) and an empty list both produce `""`.

---

## Quick start — runtime DOM injection

Use this when the host page renders client-side (SPA, dashboard, modal).

```ts
import { injectAddons } from "@shardana/addon-injector";

injectAddons(
  [
    {
      id: "contact-form",
      injection: "script",
      src: "https://forms.shardana.ai/v1/widget.js",
      params: { formId: "da-mario" },
      target: "#footer-slot",
    },
  ],
  // Optional: { target: HTMLElement, validate: false, document }
);
```

Defaults to `document.body` when no `target` (option or config) is set.

---

## Manifest validation (build-time)

The manifest sub-entry pulls in Zod and is meant for the build pipeline,
not the runtime. Validate the manifest published by the add-on author:

```ts
import {
  parseManifest,
  addonConfigSchema,
  validateAgainstManifest,
} from "@shardana/addon-injector/manifest";

const manifest = parseManifest(JSON.parse(fs.readFileSync("addon-manifest.json", "utf8")));
const config = addonConfigSchema.parse(planEntry); // from plan.yml
const issues = validateAgainstManifest(config, manifest);
if (issues.length > 0) {
  throw new Error(`Add-on misconfigured:\n - ${issues.join("\n - ")}`);
}
```

`validateAgainstManifest` checks:

- `config.id` matches `manifest.id`
- every `required` param is present
- no undeclared params slip through
- each value matches the declared `type` and `enum`

It returns the list of issues — your build decides whether to warn or
fail. The accompanying JSON Schema lives at
[`schemas/addon-manifest.schema.json`](./schemas/addon-manifest.schema.json)
and is suitable for IDE / editor hints.

---

## Configuration reference

### `AddonConfig`

| Field        | Type                                              | Notes                                                                                                  |
|--------------|---------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| `id`         | `string` (kebab-case)                             | Required. Set on every emitted node as `data-addon-id`.                                                |
| `enabled`    | `boolean` (default `true`)                        | When `false`, render returns `""` and inject returns `[]`.                                             |
| `injection`  | `"script" \| "iframe" \| "web-component"`         | Required. Determines the markup emitted.                                                               |
| `src`        | `string` (http(s))                                | Required. Asset URL — script source, iframe page, or custom-element bundle.                           |
| `params`     | `Record<string, string \| number \| boolean>`     | Forwarded as `data-*` attributes (script / web-component) or querystring (iframe).                     |
| `target`     | `string` (CSS selector)                           | Mount point for runtime injection. Ignored by build-time rendering.                                    |
| `tag`        | `string` (kebab-case, must contain a hyphen)      | `web-component` only. Defaults to `shardana-${id}`.                                                    |
| `height`     | `string \| number`                                | `iframe` only. Default `"480px"`. Numbers are treated as pixels.                                       |
| `sandbox`    | `string`                                          | `iframe` only. Default `"allow-scripts allow-forms allow-same-origin"`.                                |

### Output by injection kind

| Kind            | Render output (HTML)                                                                                 | Inject output (DOM)                              |
|-----------------|------------------------------------------------------------------------------------------------------|--------------------------------------------------|
| `script`        | `<script src="…" data-addon-id="…" data-…="…" defer></script>`                                       | One `<script defer>` element                     |
| `iframe`        | `<iframe src="…?param=v" sandbox="…" loading="lazy" referrerpolicy="…" style="…"></iframe>`          | One `<iframe>` element                           |
| `web-component` | `<script src="…" data-addon-id="…" defer></script>` + `<shardana-id data-addon-id="…" …></shardana-id>` | Two elements: loader script + custom element     |

### Camel case → kebab case

`params` keys are kebab-cased on the way out:

```ts
{ params: { mySetting: "x" } }
// → data-my-setting="x"
```

### Security

- `assertAddonConfig` rejects non-`http(s)` URLs (no `javascript:` / `data:`).
- Attribute values are HTML-escaped on render to prevent injection.
- Iframes get a restrictive sandbox by default; override only when needed.
- Script and iframe assets are fetched cross-origin — never inline secrets
  in `params`, they are exposed in the DOM.

---

## API

### `@shardana/addon-injector`

```ts
export type AddonConfig;
export type AddonParamValue;
export type InjectedAddon;
export type InjectionKind;
export type Manifest;
export type ManifestParam;
export type RenderedAddon;

export class AddonError extends Error {}

export function renderAddon(config: AddonConfig, options?: RenderOptions): string;
export function renderAddons(configs: AddonConfig[], options?: RenderOptions): string;
export function injectAddon(config: AddonConfig, options?: InjectOptions): Element[];
export function injectAddons(configs: AddonConfig[], options?: InjectOptions): Element[];
```

### `@shardana/addon-injector/render`

Render-only entry, identical to the renderers above. Use when you want
the smallest possible build dependency footprint (no DOM, no Zod).

### `@shardana/addon-injector/manifest`

Zod-backed validation utilities — heavier, build-time only.

```ts
export const manifestSchema;
export const addonConfigSchema;
export function parseManifest(raw: unknown): Manifest;
export function safeParseManifest(raw: unknown): SafeParseReturnType;
export function validateAgainstManifest(config, manifest): string[];
```

### UMD global

```ts
window.ShardanaAddonInjector = {
  renderAddon, renderAddons,
  injectAddon, injectAddons,
  AddonError,
};
```

The UMD bundle excludes the manifest helpers to fit the 5 KB gzip
budget — validate manifests during your build pipeline, not in the
browser.

---

## Bundle budget

```bash
pnpm build:size
# prints the gzipped size of dist/umd/shardana-addon-injector.umd.global.js
```

CI fails the build if the gzipped UMD exceeds 5 KB.

---

## Authoring an add-on

See [`docs/addon-contract.md`](./docs/addon-contract.md) for the full
contract: manifest fields, conventions, examples, and the params handshake.

A minimal `addon-manifest.json`:

```json
{
  "$schema": "https://shardana.ai/schemas/addon-manifest.json",
  "id": "contact-form",
  "name": "Heroic Contact Form",
  "version": "1.0.0",
  "injection": "script",
  "src": "https://forms.shardana.ai/v1/widget.js",
  "params": {
    "formId": { "type": "string", "required": true }
  },
  "license": "MIT"
}
```

---

## Development

```bash
pnpm install
pnpm test         # vitest, 44 tests across render / inject / manifest / integration / UMD bundle
pnpm build        # tsup → ESM, CJS, UMD, .d.ts
pnpm typecheck    # tsc --noEmit
pnpm build:size   # build + gzip size of the UMD bundle
```

The repo uses **TypeScript strict mode** and `vitest` with **happy-dom**
for the runtime injection tests. The UMD test ensures the bundle stays
under the 5 KB gzip budget and exposes a single global.

---

## License

[MIT](./LICENSE) © shardana.ai
