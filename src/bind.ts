// bindConfig -- walks a SchemaFor<T> against a (possibly section-narrowed)
// ConfigurationRoot's flat keys and produces a typed T.
//
// Mirrors .NET's Options validation model: every problem in the whole shape
// is collected before anything is thrown. A single bad number three levels
// deep doesn't hide a missing key at the top -- both show up together in
// one ConfigBindError, so a caller fixing config can fix everything in one
// pass instead of playing whack-a-mole against a fail-fast binder.

import type { Schema, SchemaFor } from "./schema.js";
import type { ConfigurationRoot } from "./sources/types.js";

/** Options accepted by {@link bindConfig}. */
export interface BindOptions {
  /**
   * A colon-delimited section path (e.g. `"Database:Primary"`) to narrow
   * the `ConfigurationRoot` to before binding, resolved case-insensitively
   * one segment at a time (matching every other key/section lookup this
   * binder does). Omit to bind against the root as given.
   */
  section?: string;
}

/**
 * Thrown by {@link bindConfig} when one or more problems are found while
 * binding a schema against a `ConfigurationRoot`.
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

/** First colon-delimited segment of a flat key, or the whole key if none. */
function firstSegment(key: string): string {
  const idx = key.indexOf(":");
  return idx === -1 ? key : key.slice(0, idx);
}

/** Case-insensitive exact-key lookup for a leaf value at this scope. */
function findRawLeafKey(root: ConfigurationRoot, propName: string): string | undefined {
  const lower = propName.toLowerCase();
  for (const key of root.keys()) {
    if (key.toLowerCase() === lower) {
      return key;
    }
  }
  return undefined;
}

/**
 * Case-insensitive lookup of the raw (actually-cased) top-level segment
 * under which a nested object's keys live at this scope, so `getSection`
 * can be called with the casing the config source actually used.
 */
function findRawSectionSegment(root: ConfigurationRoot, propName: string): string | undefined {
  const lower = propName.toLowerCase();
  for (const key of root.keys()) {
    const idx = key.indexOf(":");
    if (idx === -1) {
      continue;
    }
    const segment = firstSegment(key);
    if (segment.toLowerCase() === lower) {
      return segment;
    }
  }
  return undefined;
}

/**
 * Case-insensitively resolves a colon-delimited section path (e.g.
 * `"Database:Primary"`) against `root`, one segment at a time, narrowing
 * on each step. `opts.section` in {@link bindConfig} is documented as
 * matching .NET's case-insensitive config binder, same as every other
 * key/section lookup in this file -- so it needs the same raw-casing
 * resolution `findRawSectionSegment` gives internal recursive lookups,
 * rather than a raw, case-sensitive `root.getSection(section)` call.
 */
function resolveSection(root: ConfigurationRoot, section: string): ConfigurationRoot {
  let scoped = root;
  for (const segment of section.split(":")) {
    const rawSegment = findRawSectionSegment(scoped, segment);
    scoped = scoped.getSection(rawSegment ?? segment);
  }
  return scoped;
}

/** Whether `propName` (matched against `schema`'s shape) has any raw data at this scope. */
function isPresent(root: ConfigurationRoot, schema: Schema, propName: string): boolean {
  if (isLeafSchema(schema)) {
    return findRawLeafKey(root, propName) !== undefined;
  }
  return findRawSectionSegment(root, propName) !== undefined;
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
  root: ConfigurationRoot,
  schema: Schema,
  propName: string,
  path: readonly string[],
  issues: string[],
): unknown {
  const fullPath = [...path, propName].join(":");

  if (isLeafSchema(schema)) {
    const rawKey = findRawLeafKey(root, propName);
    if (rawKey === undefined) {
      issues.push(`missing required key "${fullPath}"`);
      return undefined;
    }
    return coerceLeaf(schema, root.get(rawKey) as string, fullPath, issues);
  }

  const rawSegment = findRawSectionSegment(root, propName);
  if (rawSegment === undefined) {
    issues.push(`missing required key "${fullPath}"`);
    return {};
  }
  const nestedRoot = root.getSection(rawSegment);
  return bindObject(nestedRoot, schema as Record<string, Schema>, [...path, propName], issues);
}

function bindField(
  root: ConfigurationRoot,
  schema: Schema,
  propName: string,
  path: readonly string[],
  issues: string[],
): unknown {
  if (isOptionalSchema(schema)) {
    const inner = schema.optional;
    if (!isPresent(root, inner, propName)) {
      return undefined;
    }
    return bindRequiredField(root, inner, propName, path, issues);
  }
  return bindRequiredField(root, schema, propName, path, issues);
}

function bindObject(
  root: ConfigurationRoot,
  schema: Record<string, Schema>,
  path: readonly string[],
  issues: string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const propName of Object.keys(schema)) {
    result[propName] = bindField(root, schema[propName] as Schema, propName, path, issues);
  }
  return result;
}

/**
 * Binds a flat `ConfigurationRoot` (optionally narrowed to `opts.section`
 * first) into a typed `T`, per `schema`. Key matching against schema
 * property names is case-insensitive, matching .NET's config binder.
 *
 * Every issue across the whole shape is collected before anything is
 * thrown -- see the module doc comment. Throws a single `ConfigBindError`
 * if any issues were found; otherwise returns the fully-bound `T`.
 */
export function bindConfig<T>(root: ConfigurationRoot, schema: SchemaFor<T>, opts?: BindOptions): T {
  const scoped = opts?.section !== undefined ? resolveSection(root, opts.section) : root;
  const issues: string[] = [];
  const value = bindObject(scoped, schema as unknown as Record<string, Schema>, [], issues);

  if (issues.length > 0) {
    throw new ConfigBindError(issues);
  }

  return value as T;
}
