import { describe, expect, it } from "vitest";
import { renderAddon, renderAddons } from "../src/render.js";
import { AddonError } from "../src/internal.js";
import type { AddonConfig } from "../src/types.js";

const baseScript: AddonConfig = {
  id: "contact-form",
  injection: "script",
  src: "https://forms.shardana.ai/v1/widget.js",
  params: { formId: "da-mario", submitUrl: "https://forms.shardana.ai/v1/submit" },
};

describe("renderAddon — script", () => {
  it("emits a deferred <script> with src and data-* params", () => {
    const html = renderAddon(baseScript);
    expect(html).toMatch(/^<script /);
    expect(html).toContain('src="https://forms.shardana.ai/v1/widget.js"');
    expect(html).toContain('data-addon-id="contact-form"');
    expect(html).toContain('data-form-id="da-mario"');
    expect(html).toContain('data-submit-url="https://forms.shardana.ai/v1/submit"');
    expect(html).toContain(" defer");
    expect(html).toMatch(/<\/script>$/);
  });

  it("converts camelCase param keys to kebab-case data attributes", () => {
    const html = renderAddon({ ...baseScript, params: { mySetting: "x" } });
    expect(html).toContain('data-my-setting="x"');
    expect(html).not.toContain("data-mySetting");
  });

  it("escapes attribute values to prevent HTML injection", () => {
    const html = renderAddon({
      ...baseScript,
      params: { malicious: '"><script>alert(1)</script>' },
    });
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("&quot;");
    expect(html).toContain("&lt;script&gt;");
  });

  it("returns empty string when enabled is false", () => {
    expect(renderAddon({ ...baseScript, enabled: false })).toBe("");
  });
});

describe("renderAddon — iframe", () => {
  const iframe: AddonConfig = {
    id: "booking",
    injection: "iframe",
    src: "https://book.example.com/widget",
    params: { theme: "light", id: 42 },
    height: 600,
  };

  it("appends params as querystring", () => {
    const html = renderAddon(iframe);
    expect(html).toMatch(/src="https:\/\/book\.example\.com\/widget\?(theme=light&amp;id=42|id=42&amp;theme=light)"/);
  });

  it("preserves an existing querystring with & separator", () => {
    const html = renderAddon({ ...iframe, src: "https://book.example.com/widget?ref=heroic" });
    expect(html).toContain("ref=heroic");
    expect(html).toContain("theme=light");
    expect(html.match(/\?/g)?.length).toBe(1);
  });

  it("sets safe defaults for sandbox, loading, height", () => {
    const html = renderAddon(iframe);
    expect(html).toContain('sandbox="allow-scripts allow-forms allow-same-origin"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain("height:600px");
  });

  it("honors custom sandbox + height", () => {
    const html = renderAddon({ ...iframe, sandbox: "allow-scripts", height: "100vh" });
    expect(html).toContain('sandbox="allow-scripts"');
    expect(html).toContain("height:100vh");
  });
});

describe("renderAddon — web-component", () => {
  const wc: AddonConfig = {
    id: "review-widget",
    injection: "web-component",
    src: "https://cdn.example.com/review-widget.js",
    params: { storeId: "abc" },
  };

  it("emits both a loader script and the custom element", () => {
    const html = renderAddon(wc);
    expect(html).toContain('<script src="https://cdn.example.com/review-widget.js"');
    expect(html).toContain("<shardana-review-widget");
    expect(html).toContain("data-store-id=\"abc\"");
    expect(html).toMatch(/<\/shardana-review-widget>$/);
  });

  it("uses the explicit tag when provided", () => {
    const html = renderAddon({ ...wc, tag: "Acme-Reviews" });
    expect(html).toContain("<acme-reviews");
    expect(html).toContain("</acme-reviews>");
  });
});

describe("renderAddon — validation", () => {
  it("throws on a non-https src", () => {
    expect(() => renderAddon({ ...baseScript, src: "javascript:alert(1)" })).toThrow(AddonError);
  });

  it("throws on an unknown injection kind", () => {
    expect(() => renderAddon({ ...baseScript, injection: "foo" as never })).toThrow(AddonError);
  });

  it("throws on an invalid id slug", () => {
    expect(() => renderAddon({ ...baseScript, id: "Not Slug" })).toThrow(AddonError);
  });

  it("throws when params contain non-primitive values", () => {
    expect(() =>
      renderAddon({ ...baseScript, params: { x: { nested: 1 } as never } }),
    ).toThrow(AddonError);
  });

  it("can be skipped with validate: false", () => {
    expect(() =>
      renderAddon({ ...baseScript, src: "javascript:nope" }, { validate: false }),
    ).not.toThrow();
  });
});

describe("renderAddons", () => {
  it("concatenates outputs and skips disabled entries", () => {
    const html = renderAddons([
      baseScript,
      { ...baseScript, id: "second", enabled: false },
      { ...baseScript, id: "third", injection: "iframe", src: "https://a.example.com" },
    ]);
    expect(html).toContain('data-addon-id="contact-form"');
    expect(html).not.toContain('data-addon-id="second"');
    expect(html).toContain('data-addon-id="third"');
  });

  it("returns empty string when all entries are disabled", () => {
    expect(renderAddons([{ ...baseScript, enabled: false }])).toBe("");
  });
});
