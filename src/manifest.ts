// Manifest validation. This is the **opt-in** entrypoint: pulling from
// `@shardana/addon-injector/manifest` brings in Zod (10KB+), so the runtime
// UMD bundle deliberately does NOT import this module.
//
// The manifest is the contract a third-party add-on author publishes
// alongside their widget (e.g. `addon-manifest.json` in the addon repo). The
// landing pipeline validates the manifest at build time before allowing the
// add-on to be enabled in `plan.yml`.

import { z } from "zod";
import type { Manifest } from "./types.js";

const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase kebab-case ASCII slugs");

const semverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/, "Use semantic versioning (e.g. 1.0.0)");

// Manifests are published by addon authors and must point to a public URL.
const httpsUrlSchema = z
  .string()
  .url()
  .regex(/^https?:\/\//i, "src must be http(s)");

// Per-instance configs accept either an http(s) URL OR a root-relative path
// (`/assets/...`). The latter is what the Heroic build pipeline produces
// when it copies an npm-installed addon bundle into the landing's dist.
const localOrHttpsUrlSchema = z
  .string()
  .min(1)
  .regex(/^(?:https?:\/\/|\/(?!\/))/i, "src must be http(s) or root-relative");

const paramValueSchema = z.union([z.string(), z.number(), z.boolean()]);

const manifestParamSchema = z.object({
  type: z.enum(["string", "number", "boolean"]),
  required: z.boolean().default(false),
  description: z.string().min(1).optional(),
  default: paramValueSchema.optional(),
  enum: z.array(z.string().min(1)).min(1).optional(),
});

export const injectionKindSchema = z.enum(["script", "iframe", "web-component"]);

export const manifestSchema = z.object({
  $schema: z.string().url().optional(),
  id: slugSchema,
  name: z.string().min(1),
  version: semverSchema,
  description: z.string().min(1).optional(),
  injection: injectionKindSchema,
  src: httpsUrlSchema,
  params: z.record(manifestParamSchema).optional(),
  tag: z.string().min(1).regex(/^[a-z][a-z0-9-]*-[a-z0-9-]*$/, "Custom element tag must be kebab-case with at least one hyphen").optional(),
  homepage: z.string().url().optional(),
  maintainer: z.string().min(1).optional(),
  license: z.string().min(1).optional(),
});

export const addonConfigSchema = z.object({
  id: slugSchema,
  enabled: z.boolean().default(true),
  injection: injectionKindSchema,
  src: localOrHttpsUrlSchema,
  params: z.record(paramValueSchema).default({}),
  target: z.string().min(1).optional(),
  tag: z.string().min(1).optional(),
  height: z.union([z.string(), z.number()]).optional(),
  sandbox: z.string().min(1).optional(),
});

export type ManifestSchemaInput = z.input<typeof manifestSchema>;
export type ManifestSchemaOutput = z.output<typeof manifestSchema>;
export type AddonConfigSchemaInput = z.input<typeof addonConfigSchema>;
export type AddonConfigSchemaOutput = z.output<typeof addonConfigSchema>;

/**
 * Parse + validate a manifest object. Throws ZodError on failure with the
 * full path to each issue (e.g. `params.formId.type`).
 */
export function parseManifest(raw: unknown): Manifest {
  return manifestSchema.parse(raw) as Manifest;
}

/** Same as `parseManifest` but returns `{ success, data | error }` instead of throwing. */
export function safeParseManifest(raw: unknown) {
  return manifestSchema.safeParse(raw);
}

/**
 * Cross-check a per-instance config against the add-on author's manifest:
 *  - every required param is present;
 *  - every provided param is declared in the manifest;
 *  - param values match the declared type / enum.
 *
 * Returns the list of issues (empty array = OK). Does NOT throw — callers
 * decide how to surface the errors (warning vs build failure).
 */
export function validateAgainstManifest(
  config: AddonConfigSchemaOutput,
  manifest: Manifest,
): string[] {
  const issues: string[] = [];
  if (config.id !== manifest.id) {
    issues.push(`config.id "${config.id}" does not match manifest.id "${manifest.id}"`);
  }
  const declared = manifest.params ?? {};
  const provided = config.params ?? {};

  for (const [key, decl] of Object.entries(declared)) {
    if (decl.required && !(key in provided)) {
      issues.push(`Missing required param "${key}"`);
    }
  }
  for (const [key, value] of Object.entries(provided)) {
    const decl = declared[key];
    if (!decl) {
      issues.push(`Unknown param "${key}" (not declared in manifest)`);
      continue;
    }
    if (typeof value !== decl.type) {
      issues.push(`Param "${key}" must be ${decl.type} (got ${typeof value})`);
      continue;
    }
    if (decl.type === "string" && decl.enum && !decl.enum.includes(value as string)) {
      issues.push(`Param "${key}" must be one of [${decl.enum.join(", ")}]`);
    }
  }
  return issues;
}
