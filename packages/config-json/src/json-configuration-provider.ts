// JsonConfigurationProvider -- reads a JSON file from disk and flattens it
// into the case-insensitive key/value store `ConfigurationProvider` provides:
// nested objects flatten into `Parent:Child` keys, arrays index-flatten into
// `Parent:0`, `Parent:1`, ..., and scalar leaves are string-converted. `null`
// leaves (and empty objects/arrays) are omitted entirely -- a deliberate
// choice to keep lookups simple (`get()` returning `undefined` means "absent",
// full stop) rather than also representing "present but null" or "present but
// empty" as distinct states.

import { ConfigurationProvider } from "@fnconfig/config";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { JsonConfigurationSource } from "./json-configuration-source";

export class JsonConfigurationProvider extends ConfigurationProvider {
  private readonly source: JsonConfigurationSource;

  public constructor(source: JsonConfigurationSource) {
    super();
    this.source = source;
  }

  public override load(): void {
    // Clear before repopulating: without this, a key removed from the file
    // since the last load() survives a reload() as a stale entry.
    this.data.clear();

    const resolvedPath = resolve(process.cwd(), this.source.path);

    if (!existsSync(resolvedPath)) {
      if (this.source.optional) {
        return;
      }
      throw new Error(
        `JsonConfigurationProvider: config file not found: ${resolvedPath}`,
      );
    }

    const raw = readFileSync(resolvedPath, "utf-8");
    const parsed: unknown = JSON.parse(raw);

    this.flatten(parsed, "");
  }

  private flatten(value: unknown, prefix: string): void {
    if (value === null || value === undefined) {
      // null leaves are skipped entirely -- no key is written for them.
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        this.flatten(item, prefix === "" ? String(index) : `${prefix}:${index}`);
      });
      return;
    }

    if (typeof value === "object") {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        this.flatten(child, prefix === "" ? key : `${prefix}:${key}`);
      }
      return;
    }

    // Scalar leaf (string, number, or boolean): string-convert it.
    if (prefix !== "") {
      this.set(prefix, String(value));
    }
  }
}
