// Shared contract for every configuration source and the merged view over
// them. Mirrors .NET's IConfiguration model: sources flatten their own
// input into a flat, colon-delimited-path key -> string-value map; nothing
// here does type coercion -- that's bindConfig's job in a later phase.

/**
 * A configuration source's only responsibility is to flatten whatever
 * input it owns (JSON, environment variables, CLI args, ...) into a flat
 * map of colon-delimited keys to string values.
 *
 * Example: the nested JSON `{"Server":{"Port":8080}}` flattens to
 * `{"Server:Port": "8080"}` -- note the scalar gets string-converted,
 * since the whole config model downstream is string-valued.
 */
export interface ConfigSource {
  load(): Record<string, string>;
}

/**
 * A read-only, merged view over a flat key -> string-value map.
 *
 * Constructed from the already-merged map produced by layering one or more
 * `ConfigSource`s together (merge order/precedence is ConfigBuilder's
 * concern, not this class's).
 */
export class ConfigurationRoot {
  private readonly data: ReadonlyMap<string, string>;

  public constructor(data: ReadonlyMap<string, string>) {
    this.data = data;
  }

  /** Exact key lookup. Returns `undefined` if the key isn't present. */
  public get(key: string): string | undefined {
    return this.data.get(key);
  }

  /**
   * Returns a new `ConfigurationRoot` scoped to keys that start with
   * `${prefix}:`, with that prefix (and its trailing colon) stripped from
   * each returned key. A key that exactly equals `prefix` (no trailing
   * colon) is not itself a member of the section and is excluded.
   *
   * Prefix matching is case-insensitive, mirroring .NET's `IConfiguration`
   * and the rest of this package (ConfigBuilder's merge and bindConfig's key
   * matching both case-fold). This matters once a section is layered from
   * multiple sources: an UPPERCASE env `SERVER:HOST` and a natural-case CLI
   * `Server:Port` are the same `Server` section, and a case-sensitive prefix
   * match would silently drop whichever keys don't match the queried casing.
   * Stripped keys retain their source casing; leaf lookups downstream are
   * themselves case-insensitive.
   */
  public getSection(prefix: string): ConfigurationRoot {
    const scopePrefix = `${prefix}:`;
    const foldedPrefix = scopePrefix.toLowerCase();
    const scoped = new Map<string, string>();

    for (const [key, value] of this.data) {
      if (key.toLowerCase().startsWith(foldedPrefix)) {
        scoped.set(key.slice(scopePrefix.length), value);
      }
    }

    return new ConfigurationRoot(scoped);
  }

  /** All keys currently in scope for this root. */
  public keys(): readonly string[] {
    return [...this.data.keys()];
  }
}
