// bindConfig -- walks a SchemaFor<T> against an IConfiguration (via
// get/getSection/getChildren) and produces a typed T.
//
// Mirrors .NET's Options validation model: every problem in the whole shape
// is collected before anything is thrown. A single bad number three levels
// deep doesn't hide a missing key at the top -- both show up together in
// one ConfigBindError, so a caller fixing config can fix everything in one
// pass instead of playing whack-a-mole against a fail-fast binder.
//
// Case-insensitivity is now free from the provider store (an UPPERCASE env
// key and a natural-cased JSON key resolve to the same lookup), so this file
// no longer hand-rolls the raw-casing key/segment scans the single-Map MVP
// needed -- it just walks IConfiguration, which folds case internally.

import type { IConfiguration, IConfigurationSection } from "@fnconfig/core";
import type { Schema, SchemaFor } from "./schema";

/** Options accepted by {@link bindConfig}. */
export interface BindOptions {
  /**
   * A colon-delimited section path (e.g. `"Database:Primary"`) to narrow the
   * configuration to before binding. Resolved case-insensitively (like every
   * other key/section lookup this binder does -- the provider store folds
   * case). Omit to bind against the configuration as given.
   */
  section?: string;
}

/**
 * Thrown by {@link bindConfig} when one or more problems are found while
 * binding a schema against an `IConfiguration`.
 *
 * Every issue across the whole shape (missing keys, wrong-kind values,
 * problems nested arbitrarily deep in sections) is collected and reported
 * together in `issues`/`message`, rather than throwing on the first one --
 * see the module doc comment above for why.
 */
export class ConfigBindError extends Error {
  /** One human-readable description per problem found; never empty. */
  public readonly issues: readonly string[];

  public constructor(issues: readonly string[]) {
    super(issues.join("; "));
    this.name = "ConfigBindError";
    this.issues = issues;
  }
}

function isLeafSchema(schema: Schema): schema is "string" | "number" | "boolean" {
  return schema === "string" || schema === "number" || schema === "boolean";
}

function isOptionalSchema(schema: Schema): schema is { optional: Schema } {
  return typeof schema === "object" && schema !== null && "optional" in schema;
}

/**
 * Whether a section actually exists -- has a value directly, or has any child
 * sections. Mirrors .NET's `ConfigurationExtensions.Exists`. A section object
 * is always returned by `getSection` (never null), so presence is decided by
 * whether anything lives at or under its path.
 */
function sectionExists(section: IConfigurationSection): boolean {
  if (section.value !== undefined) {
    return true;
  }
  for (const _child of section.getChildren()) {
    return true;
  }
  return false;
}

/** Whether `propName` (matched against `schema`'s shape) has any data at this scope. */
function isPresent(config: IConfiguration, schema: Schema, propName: string): boolean {
  if (isLeafSchema(schema)) {
    return config.get(propName) !== undefined;
  }
  return sectionExists(config.getSection(propName));
}

function coerceLeaf(
  schema: "string" | "number" | "boolean",
  raw: string,
  fullPath: string,
  issues: string[],
): unknown {
  switch (schema) {
    case "string":
      return raw;
    case "number": {
      // `Number("")` and `Number("   ")` both coerce to `0` rather than
      // `NaN` -- reject blank raw values explicitly so an empty env var
      // (`APP_Port=`) or CLI arg (`--Port=`) is reported as an invalid
      // number instead of silently binding to a valid-looking zero.
      if (raw.trim() === "") {
        issues.push(`invalid number for "${fullPath}": "${raw}"`);
        return undefined;
      }
      const n = Number(raw);
      // `Number.isFinite`, not `!Number.isNaN`: `Number("Infinity")`,
      // `Number("-Infinity")`, and an overflowing literal like
      // `Number("1e400")` (=== Infinity) are all non-NaN, so a NaN-only guard
      // would accept them as valid numbers. A non-finite config number is
      // never intended -- reject it down the same aggregate-error path.
      if (!Number.isFinite(n)) {
        issues.push(`invalid number for "${fullPath}": "${raw}"`);
        return undefined;
      }
      return n;
    }
    case "boolean": {
      const lower = raw.toLowerCase();
      if (lower === "true") {
        return true;
      }
      if (lower === "false") {
        return false;
      }
      issues.push(`invalid boolean for "${fullPath}": "${raw}"`);
      return undefined;
    }
  }
}

/** Binds a required (already-unwrapped-of-optional) field, recording issues as needed. */
function bindRequiredField(
  config: IConfiguration,
  schema: Schema,
  propName: string,
  path: readonly string[],
  issues: string[],
): unknown {
  const fullPath = [...path, propName].join(":");

  if (isLeafSchema(schema)) {
    const raw = config.get(propName);
    if (raw === undefined) {
      issues.push(`missing required key "${fullPath}"`);
      return undefined;
    }
    return coerceLeaf(schema, raw, fullPath, issues);
  }

  const section = config.getSection(propName);
  if (!sectionExists(section)) {
    issues.push(`missing required key "${fullPath}"`);
    return {};
  }
  return bindObject(section, schema as Record<string, Schema>, [...path, propName], issues);
}

function bindField(
  config: IConfiguration,
  schema: Schema,
  propName: string,
  path: readonly string[],
  issues: string[],
): unknown {
  if (isOptionalSchema(schema)) {
    const inner = schema.optional;
    if (!isPresent(config, inner, propName)) {
      return undefined;
    }
    return bindRequiredField(config, inner, propName, path, issues);
  }
  return bindRequiredField(config, schema, propName, path, issues);
}

function bindObject(
  config: IConfiguration,
  schema: Record<string, Schema>,
  path: readonly string[],
  issues: string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const propName of Object.keys(schema)) {
    result[propName] = bindField(config, schema[propName] as Schema, propName, path, issues);
  }
  return result;
}

/**
 * Binds an `IConfiguration` (optionally narrowed to `opts.section` first) into
 * a typed `T`, per `schema`. Key matching against schema property names is
 * case-insensitive, matching .NET's config binder.
 *
 * Every issue across the whole shape is collected before anything is
 * thrown -- see the module doc comment. Throws a single `ConfigBindError`
 * if any issues were found; otherwise returns the fully-bound `T`.
 */
export function bindConfig<T>(config: IConfiguration, schema: SchemaFor<T>, opts?: BindOptions): T {
  const scoped = opts?.section !== undefined ? config.getSection(opts.section) : config;
  const issues: string[] = [];
  const value = bindObject(scoped, schema as unknown as Record<string, Schema>, [], issues);

  if (issues.length > 0) {
    throw new ConfigBindError(issues);
  }

  return value as T;
}
