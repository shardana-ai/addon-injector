import { describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import { renderAddons } from "../src/render.js";
import { injectAddons } from "../src/inject.js";
import { addonConfigSchema, parseManifest, validateAgainstManifest } from "../src/manifest.js";
import type { AddonConfig } from "../src/types.js";

const manifest = parseManifest({
  id: "contact-form",
  name: "Heroic Contact Form",
  version: "1.0.0",
  injection: "script",
  src: "https://forms.shardana.ai/v1/widget.js",
  params: {
    formId: { type: "string", required: true },
    submitUrl: { type: "string", required: true },
  },
});

const planAddons = [
  {
    id: "contact-form",
    enabled: true,
    injection: "script" as const,
    src: "https://forms.shardana.ai/v1/widget.js",
    params: { formId: "da-mario", submitUrl: "https://forms.shardana.ai/v1/submit" },
  },
  {
    id: "review-widget",
    enabled: true,
    injection: "web-component" as const,
    src: "https://cdn.example.com/reviews.js",
    params: { storeId: "abc" },
  },
  {
    id: "old-widget",
    enabled: false,
    injection: "script" as const,
    src: "https://example.com/legacy.js",
    params: {},
  },
];

describe("integration: plan.addons → manifest validation → render → inject", () => {
  it("a config that passes the manifest also renders + mounts cleanly", () => {
    const parsed = addonConfigSchema.parse(planAddons[0]!);
    expect(validateAgainstManifest(parsed, manifest)).toEqual([]);

    const html = renderAddons([parsed as AddonConfig]);
    expect(html).toContain('data-addon-id="contact-form"');
    expect(html).toContain('data-form-id="da-mario"');
  });

  it("renderAddons + DOMParser produces nodes equivalent to injectAddons", () => {
    const html = renderAddons(planAddons as AddonConfig[]);
    const win = new Window({ url: "https://landing.shardana.ai/" });
    win.document.body.innerHTML = html;
    const renderedIds = Array.from(win.document.body.querySelectorAll("[data-addon-id]"))
      .map((n) => n.getAttribute("data-addon-id"));
    win.close();

    const win2 = new Window({ url: "https://landing.shardana.ai/" });
    const mounted = injectAddons(planAddons as AddonConfig[], {
      document: win2.document as unknown as Document,
    });
    const injectedIds = mounted.map((n) => n.getAttribute("data-addon-id"));
    win2.close();

    // Disabled entries are skipped in both modes; web-component emits 2 nodes.
    expect(renderedIds).toEqual(["contact-form", "review-widget", "review-widget"]);
    expect(injectedIds).toEqual(["contact-form", "review-widget", "review-widget"]);
  });

  it("an addon with a missing required param surfaces an issue without breaking render", () => {
    const broken = addonConfigSchema.parse({
      id: "contact-form",
      injection: "script",
      src: "https://forms.shardana.ai/v1/widget.js",
      params: { formId: "x" },
    });
    const issues = validateAgainstManifest(broken, manifest);
    expect(issues).toContain('Missing required param "submitUrl"');
    // render still works — the build pipeline decides whether to fail on issues
    expect(renderAddons([broken as AddonConfig])).toContain('data-addon-id="contact-form"');
  });
});
