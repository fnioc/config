// A ConfigSource that reads a JSON file from disk and flattens it into a
// flat colon-delimited key -> string-value map, mirroring .NET's JSON
// configuration provider conventions: nested objects flatten into
// `Parent:Child` keys, arrays index-flatten into `Parent:0`, `Parent:1`,
// ... and scalar leaves are string-converted. `null` leaves are omitted
// entirely -- there is no such thing as a "null" config value downstream.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ConfigSource } from "./types.js";

/** Options accepted by {@link JsonFileSource}'s constructor. */
export interface JsonFileSourceOptions {
  /**
   * When `true`, a missing file yields an empty config instead of
   * throwing. Malformed JSON in a file that *does* exist always throws,
   * regardless of this flag -- "optional" only covers file absence, not
   * file validity.
   */
  optional?: boolean;
}

/**
 * A {@link ConfigSource} that reads a JSON file from disk (resolved relative
 * to `process.cwd()`) and flattens it into a flat colon-delimited key ->
 * string-value map, mirroring .NET's JSON configuration provider
 * conventions -- see the module doc comment above for the exact flattening
 * rules (nested objects, arrays, `null` leaves, scalar stringification).
 */
export class JsonFileSource implements ConfigSource {
  private readonly path: string;
  private readonly optional: boolean;

  public constructor(path: string, opts?: JsonFileSourceOptions) {
    this.path = path;
    this.optional = opts?.optional ?? false;
  }

  public load(): Record<string, string> {
    const resolvedPath = resolve(process.cwd(), this.path);

    if (!existsSync(resolvedPath)) {
      if (this.optional) {
        return {};
      }
      throw new Error(
        `JsonFileSource: config file not found: ${resolvedPath}`,
      );
    }

    const raw = readFileSync(resolvedPath, "utf-8");
    const parsed: unknown = JSON.parse(raw);

    const result: Record<string, string> = {};
    flatten(parsed, "", result);
    return result;
  }
}

function flatten(
  value: unknown,
  prefix: string,
  target: Record<string, string>,
): void {
  if (value === null || value === undefined) {
    // null leaves are skipped entirely -- no key is written for them.
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      flatten(item, prefix === "" ? String(index) : `${prefix}:${index}`, target);
    });
    return;
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      flatten(child, prefix === "" ? key : `${prefix}:${key}`, target);
    }
    return;
  }

  // Scalar leaf (string, number, or boolean): string-convert it.
  if (prefix !== "") {
    target[prefix] = String(value);
  }
}
