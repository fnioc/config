// ConfigSource that flattens process.env into the flat key -> string-value
// map every source produces. Two pieces of translation happen here:
//
//   1. Optional prefix filtering -- only vars whose name starts with
//      `prefix` are kept, and the prefix is stripped from the resulting key.
//   2. `__` (double underscore) -> `:` mapping on the remaining name, since
//      most shells/platforms can't hold a literal colon in an env var name.
//      This mirrors .NET's `IConfiguration` environment-variable convention.
//
// Case is preserved as given in the env var name; case-insensitive matching
// is ConfigurationRoot/binding's concern, not this source's.

import type { ConfigSource } from "./types.js";

/**
 * A {@link ConfigSource} that flattens `process.env` into the flat
 * colon-delimited key -> string-value map every source produces, per an
 * optional name prefix and the `__` -> `:` translation described in the
 * module doc comment above.
 */
export class EnvironmentVariablesSource implements ConfigSource {
  private readonly prefix: string | undefined;

  public constructor(prefix?: string) {
    this.prefix = prefix;
  }

  public load(): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [name, value] of Object.entries(process.env)) {
      if (value === undefined) {
        continue;
      }

      if (this.prefix !== undefined && !name.startsWith(this.prefix)) {
        continue;
      }

      const stripped =
        this.prefix !== undefined ? name.slice(this.prefix.length) : name;
      const key = stripped.replaceAll("__", ":");

      result[key] = value;
    }

    return result;
  }
}
