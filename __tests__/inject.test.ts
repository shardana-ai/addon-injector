import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import { injectAddon, injectAddons } from "../src/inject.js";
import { AddonError } from "../src/internal.js";
import type { AddonConfig } from "../src/types.js";

let window: Window;
let document: Document;

beforeEach(() => {
  window = new Window({ url: "https://landing.shardana.ai/" });
  document = window.document as unknown as Document;
});

afterEach(() => {
  window.close();
});

const scriptConfig: AddonConfig = {
  id: "contact-form",
  injection: "script",
  src: "https://forms.shardana.ai/v1/widget.js",
  params: { formId: "da-mario" },
};

describe("injectAddon — script", () => {
  it("appends a deferred script tag with data-* params to body by default", () => {
    const elements = injectAddon(scriptConfig, { document });
    expect(elements).toHaveLength(1);
    const script = elements[0] as HTMLScriptElement;
    expect(script.tagName).toBe("SCRIPT");
    expect(script.src).toBe("https://forms.shardana.ai/v1/widget.js");
    expect(script.defer).toBe(true);
    expect(script.getAttribute("data-addon-id")).toBe("contact-form");
    expect(script.getAttribute("data-form-id")).toBe("da-mario");
    expect(document.body.contains(script)).toBe(true);
  });

  it("returns [] for disabled add-ons and does not touch the DOM", () => {
    const before = document.body.children.length;
    expect(injectAddon({ ...scriptConfig, enabled: false }, { document })).toEqual([]);
    expect(document.body.children.length).toBe(before);
  });

  it("uses an explicit options.target over config.target", () => {
    const main = document.createElement("main");
    document.body.appendChild(main);
    injectAddon(scriptConfig, { document, target: main });
    expect(main.querySelector("script")).not.toBeNull();
    expect(document.body.querySelector(":scope > script")).toBeNull();
  });

  it("resolves config.target as a CSS selector", () => {
    const slot = document.createElement("div");
    slot.id = "addon-slot";
    document.body.appendChild(slot);
    injectAddon({ ...scriptConfig, target: "#addon-slot" }, { document });
    expect(slot.querySelector("script")).not.toBeNull();
  });

  it("throws when config.target does not match", () => {
    expect(() => injectAddon({ ...scriptConfig, target: "#missing" }, { document })).toThrow(AddonError);
  });
});

describe("injectAddon — iframe", () => {
  const iframeConfig: AddonConfig = {
    id: "booking",
    injection: "iframe",
    src: "https://book.example.com/widget",
    params: { theme: "light" },
    height: 320,
  };

  it("appends a sandboxed iframe with params in the querystring", () => {
    const [iframe] = injectAddon(iframeConfig, { document }) as HTMLIFrameElement[];
    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe.src).toBe("https://book.example.com/widget?theme=light");
    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts allow-forms allow-same-origin");
    expect(iframe.getAttribute("loading")).toBe("lazy");
    expect(iframe.style.height).toBe("320px");
    expect(iframe.style.border.replace(/px$/, "")).toBe("0");
  });
});

describe("injectAddon — web-component", () => {
  it("appends loader script + custom element with data-* attributes", () => {
    const elements = injectAddon(
      {
        id: "reviews",
        injection: "web-component",
        src: "https://cdn.example.com/reviews.js",
        params: { storeId: "abc" },
      },
      { document },
    );
    expect(elements).toHaveLength(2);
    const [script, element] = elements;
    expect(script!.tagName).toBe("SCRIPT");
    expect(element!.tagName.toLowerCase()).toBe("shardana-reviews");
    expect(element!.getAttribute("data-store-id")).toBe("abc");
  });
});

describe("injectAddons", () => {
  it("mounts every enabled config in order", () => {
    const mounted = injectAddons(
      [
        scriptConfig,
        { ...scriptConfig, id: "skip-me", enabled: false },
        { ...scriptConfig, id: "second" },
      ],
      { document },
    );
    expect(mounted.map((e) => e.getAttribute("data-addon-id"))).toEqual([
      "contact-form",
      "second",
    ]);
  });

  it("throws when invalid config is encountered (validate=true)", () => {
    expect(() =>
      injectAddons([{ ...scriptConfig, src: "javascript:nope" }], { document }),
    ).toThrow(AddonError);
  });
});
