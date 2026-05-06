import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  addonConfigSchema,
  manifestSchema,
  parseManifest,
  safeParseManifest,
  validateAgainstManifest,
} from "../src/manifest.js";
import type { Manifest } from "../src/types.js";

const here = dirname(fileURLToPath(import.meta.url));

const validManifest = {
  $schema: "https://shardana.ai/schemas/addon-manifest.json",
  id: "contact-form",
  name: "Contact Form",
  version: "1.0.0",
  injection: "script",
  src: "https://forms.shardana.ai/v1/widget.js",
  params: {
    formId: { type: "string", required: true, description: "Form id" },
    theme: { type: "string", enum: ["light", "dark"], default: "light" },
  },
};

describe("manifestSchema", () => {
  it("accepts a valid manifest", () => {
    expect(manifestSchema.parse(validManifest).id).toBe("contact-form");
  });

  it("rejects missing required fields", () => {
    const result = safeParseManifest({ ...validManifest, name: undefined });
    expect(result.success).toBe(false);
  });

  it("rejects non-semver versions", () => {
    expect(safeParseManifest({ ...validManifest, version: "v1" }).success).toBe(false);
  });

  it("rejects non-https src", () => {
    expect(safeParseManifest({ ...validManifest, src: "ftp://example.com" }).success).toBe(false);
  });

  it("rejects custom-element tags without a hyphen", () => {
    expect(
      safeParseManifest({ ...validManifest, injection: "web-component", tag: "noHyphen" }).success,
    ).toBe(false);
  });

  it("validates the bundled examples/contact-form.manifest.json fixture", () => {
    const json = JSON.parse(
      readFileSync(resolve(here, "../examples/contact-form.manifest.json"), "utf8"),
    );
    expect(parseManifest(json).id).toBe("contact-form");
  });
});

describe("addonConfigSchema", () => {
  it("defaults enabled to true and params to {}", () => {
    const parsed = addonConfigSchema.parse({
      id: "x",
      injection: "script",
      src: "https://example.com/w.js",
    });
    expect(parsed.enabled).toBe(true);
    expect(parsed.params).toEqual({});
  });

  it("rejects unsupported param value types", () => {
    expect(
      addonConfigSchema.safeParse({
        id: "x",
        injection: "script",
        src: "https://example.com/w.js",
        params: { weird: { nested: 1 } },
      }).success,
    ).toBe(false);
  });
});

describe("validateAgainstManifest", () => {
  const manifest: Manifest = parseManifest(validManifest) as unknown as Manifest;

  it("passes when required params are present and types match", () => {
    expect(
      validateAgainstManifest(
        addonConfigSchema.parse({
          id: "contact-form",
          injection: "script",
          src: "https://forms.shardana.ai/v1/widget.js",
          params: { formId: "da-mario", theme: "dark" },
        }),
        manifest,
      ),
    ).toEqual([]);
  });

  it("flags a missing required param", () => {
    const issues = validateAgainstManifest(
      addonConfigSchema.parse({
        id: "contact-form",
        injection: "script",
        src: "https://forms.shardana.ai/v1/widget.js",
        params: {},
      }),
      manifest,
    );
    expect(issues.some((i) => /required.*formId/.test(i))).toBe(true);
  });

  it("flags an undeclared param", () => {
    const issues = validateAgainstManifest(
      addonConfigSchema.parse({
        id: "contact-form",
        injection: "script",
        src: "https://forms.shardana.ai/v1/widget.js",
        params: { formId: "x", unknownField: "y" },
      }),
      manifest,
    );
    expect(issues.some((i) => /Unknown param "unknownField"/.test(i))).toBe(true);
  });

  it("flags an invalid enum value", () => {
    const issues = validateAgainstManifest(
      addonConfigSchema.parse({
        id: "contact-form",
        injection: "script",
        src: "https://forms.shardana.ai/v1/widget.js",
        params: { formId: "x", theme: "neon" },
      }),
      manifest,
    );
    expect(issues.some((i) => /must be one of/.test(i))).toBe(true);
  });

  it("flags an id mismatch between config and manifest", () => {
    const issues = validateAgainstManifest(
      addonConfigSchema.parse({
        id: "other",
        injection: "script",
        src: "https://forms.shardana.ai/v1/widget.js",
        params: { formId: "x" },
      }),
      manifest,
    );
    expect(issues.some((i) => /does not match manifest/.test(i))).toBe(true);
  });
});
