# Heroic add-on contract

This document is the source of truth for **how to write a Heroic Landing
add-on**. Everything that flows through `@shardana/addon-injector` —
contact forms, booking widgets, review carousels, custom embeds — has
to satisfy this contract.

## Goals

- Adding an add-on never requires changes to the Heroic landing template.
- The Heroic build pipeline can statically validate that a customer's
  `plan.yml` matches the add-on author's manifest.
- The add-on can be loaded via `<script>`, `<iframe>` or a custom
  element. Hosting is the author's responsibility.

## 1. The manifest (`addon-manifest.json`)

Every add-on repository MUST publish a top-level `addon-manifest.json`.
The Heroic build resolves it (locally bundled, fetched from a CDN, or
pinned by URL) and validates it with `parseManifest` from
`@shardana/addon-injector/manifest`.

### Required fields

| Field        | Type                                  | Notes                                                                                  |
|--------------|---------------------------------------|----------------------------------------------------------------------------------------|
| `id`         | string (kebab-case ASCII slug)        | Stable identifier. MUST match the `id` used in customer `plan.yml → addons[]`.         |
| `name`       | string                                | Human-readable name shown in the admin panel.                                          |
| `version`    | string (semver)                       | `1.2.3`, `1.0.0-beta.2`, …                                                             |
| `injection`  | `"script" \| "iframe" \| "web-component"` | Default delivery mechanism. Customers MAY override per-instance.                  |
| `src`        | string (`http(s)` URL)                | Default asset URL. Customers MAY override (e.g. self-hosted bundle).                   |

### Optional fields

| Field         | Type                                | Notes                                                                                       |
|---------------|-------------------------------------|---------------------------------------------------------------------------------------------|
| `description` | string                              | One-line summary for the admin UI.                                                          |
| `params`      | `Record<string, ManifestParam>`     | Declared params — see below.                                                                 |
| `tag`         | string (kebab-case, contains hyphen) | `web-component` only. Defaults to `shardana-${id}`.                                         |
| `homepage`    | URL                                 | Project homepage / documentation.                                                            |
| `maintainer`  | string                              | Author / company.                                                                            |
| `license`     | string (SPDX id)                    | E.g. `"MIT"`.                                                                                |
| `$schema`     | URL                                 | `"https://shardana.ai/schemas/addon-manifest.json"` — enables editor hints.                  |

### `ManifestParam`

Each entry in `params` declares ONE parameter:

```json
"params": {
  "formId":   { "type": "string",  "required": true,  "description": "Form id from the admin panel" },
  "theme":    { "type": "string",  "enum": ["light", "dark"], "default": "light" },
  "rate":     { "type": "number",  "default": 1.0 },
  "compact":  { "type": "boolean", "default": false }
}
```

Rules:

- `type` is required (`"string" | "number" | "boolean"`).
- `required` defaults to `false`.
- `default` MUST match `type`.
- `enum` is only valid for `type: "string"` and forces an exact match.
- `description` is plain text — the admin UI may render it as helper copy.

The Heroic build will reject the customer's plan when:

- A required param is missing.
- A provided param is not declared.
- A provided value is the wrong type or fails the `enum` check.

### Reference JSON Schema

`@shardana/addon-injector/schemas/addon-manifest.schema.json` is the
draft-07 JSON Schema equivalent of the Zod manifest schema. Wire it up
in your editor for autocomplete / validation.

### Example — `addon-contact-form`

```json
{
  "$schema": "https://shardana.ai/schemas/addon-manifest.json",
  "id": "contact-form",
  "name": "Heroic Contact Form",
  "version": "1.0.0",
  "description": "Embeddable contact form that posts submissions to Mailgun via a Lambda backend.",
  "injection": "script",
  "src": "https://forms.shardana.ai/v1/widget.js",
  "params": {
    "formId":    { "type": "string", "required": true,  "description": "Unique form identifier created by the admin panel." },
    "submitUrl": { "type": "string", "required": true,  "description": "Lambda endpoint that handles form submissions." },
    "fields":    { "type": "string", "default": "name,email,message" },
    "theme":     { "type": "string", "enum": ["light", "dark"], "default": "light" }
  },
  "homepage": "https://github.com/shardana-ai/addon-contact-form",
  "maintainer": "shardana.ai",
  "license": "MIT"
}
```

## 2. The runtime artifact

What you ship at `src` depends on `injection`.

### `injection: "script"`

A regular browser script. The injector emits:

```html
<script src="<src>" data-addon-id="<id>" data-<param>="<value>" … defer></script>
```

The script:

- MUST be `defer`-safe (it is loaded with `defer`).
- MUST locate its own mount point. Pattern:
  `document.currentScript.parentElement` or a custom selector you
  document. Example:

  ```js
  const tag = document.currentScript;
  const mount = document.createElement("div");
  mount.dataset.formId = tag.dataset.formId;
  tag.after(mount);
  // hydrate `mount` …
  ```

- SHOULD read params from `data-*` attributes on the script tag, NOT
  from globals. Heroic kebab-cases keys (`formId` → `data-form-id`) — most
  frameworks and `dataset` access work without further changes.

### `injection: "iframe"`

The injector emits a sandboxed iframe pointing at `src` with params on
the querystring:

```html
<iframe
  src="https://book.example.com/widget?theme=light&id=42"
  data-addon-id="booking"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
  sandbox="allow-scripts allow-forms allow-same-origin"
  title="Add-on booking"
  style="width:100%;border:0;height:480px;"
></iframe>
```

Authors:

- MUST handle params from `URLSearchParams(location.search)`.
- SHOULD respect the `referrerpolicy` and avoid leaking PII to third
  parties.
- SHOULD support `postMessage` resize events if the widget is taller
  than `height` (480 px default).

### `injection: "web-component"`

The injector emits both the loader script and the custom element on the
page:

```html
<script src="https://cdn.example.com/reviews.js" data-addon-id="reviews" defer></script>
<shardana-reviews data-addon-id="reviews" data-store-id="abc"></shardana-reviews>
```

Authors:

- MUST `customElements.define(...)` the tag the manifest declares (or
  the default `shardana-${id}`).
- SHOULD read params from `dataset` inside `connectedCallback`.
- SHOULD treat the custom element as the root container — Heroic does
  not provide its own wrapper.

## 3. Hosting & versioning

- The `src` URL SHOULD be served over HTTPS with permissive CORS so the
  widget can call back to its own backend.
- Add-on authors are responsible for caching headers and CDN distribution.
- Bumping a manifest's `version` does not auto-update customer pages —
  Heroic pins the URL declared in `plan.yml`. Use stable URLs with
  versioned paths (e.g. `…/v1/widget.js`) when you want backward
  compatibility, and a non-versioned alias (e.g. `…/latest/widget.js`)
  when you want auto-updates.

## 4. Security checklist

- [ ] `src` is served over HTTPS.
- [ ] Widget does not request more permissions than needed (clipboard,
      mic, geolocation, …). Document them in `description`.
- [ ] Any sandbox flags you require beyond
      `allow-scripts allow-forms allow-same-origin` are documented for
      the customer to set in `plan.yml`.
- [ ] No secrets in `params`. The DOM is public.
- [ ] CSP-friendly: no `eval`, no inline scripts mutating `document.body`
      outside the mount point.

## 5. Testing your add-on

A useful smoke harness:

```ts
import { Window } from "happy-dom";
import { injectAddons } from "@shardana/addon-injector";

const win = new Window({ url: "https://landing.shardana.ai/" });
injectAddons(
  [{ id: "your-id", injection: "script", src: "http://localhost:8080/widget.js", params: {} }],
  { document: win.document as unknown as Document },
);
expect(win.document.querySelector('[data-addon-id="your-id"]')).not.toBeNull();
```

Combine with `parseManifest` + `validateAgainstManifest` to assert the
plan / manifest pair is valid.

## 6. Submitting a new add-on

1. Publish the manifest at a stable URL (or alongside your widget bundle).
2. Open a PR on
   [shardana-ai/landing.shardana.ai](https://github.com/shardana-ai/landing.shardana.ai)
   that adds an entry under `docs/addons/` describing the add-on.
3. Heroic admins enable it for customers; their `plan.yml` then references
   `id` and the per-customer `params`.

That's the contract. Keep manifests honest, treat params like an API,
and the injector will do the rest.
