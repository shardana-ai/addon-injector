import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");
const umdPath = resolve(pkgRoot, "dist/umd/shardana-addon-injector.umd.global.js");

// Build on demand so the test is self-contained — `pnpm test` and `pnpm build &&
// pnpm test` both pass. Skipped when the bundler is unavailable in CI.
function ensureBuilt(): boolean {
  if (existsSync(umdPath)) return true;
  try {
    execSync("pnpm exec tsup", { cwd: pkgRoot, stdio: "ignore" });
    return existsSync(umdPath);
  } catch {
    return false;
  }
}

describe.skipIf(process.env.HEROIC_SKIP_BUILD_TEST === "1")(
  "UMD bundle",
  () => {
    it("is present and under 5KB gzipped (the public budget)", () => {
      expect(ensureBuilt()).toBe(true);
      const raw = readFileSync(umdPath);
      const gz = gzipSync(raw);
      expect(gz.length).toBeLessThan(5 * 1024);
      expect(statSync(umdPath).size).toBeGreaterThan(0);
    });

    it("exposes the public API as a single global when loaded as an IIFE", () => {
      expect(ensureBuilt()).toBe(true);
      const code = readFileSync(umdPath, "utf8");
      // tsup IIFE output looks like `var ShardanaAddonInjector = (() => {...})();`.
      // Wrap it in a Function that returns the global so we can inspect it
      // without depending on a browser script-loader.
      const exposed = new Function(`${code}\nreturn ShardanaAddonInjector;`)() as Record<string, unknown>;
      expect(typeof exposed.injectAddon).toBe("function");
      expect(typeof exposed.injectAddons).toBe("function");
      expect(typeof exposed.renderAddon).toBe("function");
      expect(typeof exposed.renderAddons).toBe("function");
    });
  },
);
