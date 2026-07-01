// ConfigBuilder -- registers ConfigSources in order and layers their
// independently-flattened outputs into a single ConfigurationRoot.
//
// The core rule: each source flattens its own input on its own (a JSON
// file's nested structure, process.env, argv, ...); ConfigBuilder never
// looks at those original shapes. It only performs a shallow, per-key merge
// over the flat maps those sources produce, in registration order, so a
// later-registered source's value for a given key overwrites an earlier
// one's. This is intentionally NOT a deep/structural merge -- there's
// nothing structural left to merge once every source has already flattened.

import {
  CommandLineSource,
  type CommandLineSourceOptions,
} from "./sources/command-line.js";
import { EnvironmentVariablesSource } from "./sources/environment-variables.js";
import { JsonFileSource, type JsonFileSourceOptions } from "./sources/json-file.js";
import { ConfigurationRoot, type ConfigSource } from "./sources/types.js";

/**
 * Registers {@link ConfigSource}s in registration order and layers their
 * independently-flattened output into a single {@link ConfigurationRoot}
 * via `build()`. Later-registered sources take precedence over earlier ones
 * on a per-key basis -- see the module doc comment above for the full merge
 * model.
 *
 * @example
 * ```ts
 * const root = new ConfigBuilder()
 *   .addJsonFile("appsettings.json")
 *   .addJsonFile("appsettings.Development.json", { optional: true })
 *   .addEnvironmentVariables("APP_")
 *   .addCommandLine(process.argv.slice(2))
 *   .build();
 * ```
 */
export class ConfigBuilder {
  private readonly sources: ConfigSource[] = [];

  /** Registers a JSON file source; later calls take precedence in build(). */
  public addJsonFile(path: string, opts?: JsonFileSourceOptions): this {
    this.sources.push(new JsonFileSource(path, opts));
    return this;
  }

  /** Registers a process.env source, optionally scoped by prefix. */
  public addEnvironmentVariables(prefix?: string): this {
    this.sources.push(new EnvironmentVariablesSource(prefix));
    return this;
  }

  /** Registers a command-line argv source. */
  public addCommandLine(
    argv: readonly string[],
    opts?: CommandLineSourceOptions,
  ): this {
    this.sources.push(new CommandLineSource(argv, opts));
    return this;
  }

  /**
   * Loads every registered source in registration order and merges their
   * flat maps key by key, with later sources overwriting earlier ones.
   *
   * The merge is case-folding -- matching .NET's `IConfiguration`, which
   * this package otherwise mirrors throughout (see e.g. bindConfig's
   * case-insensitive property matching). Sources are free to use whatever
   * casing is natural to them (JSON keeps the file's casing; env vars are
   * conventionally UPPERCASE), so a later source's key must overwrite an
   * earlier one's even when the two differ only in case -- otherwise both
   * survive side by side in the merged map and later lookups can silently
   * resolve to the earlier (stale) value instead of the intended override.
   */
  public build(): ConfigurationRoot {
    const merged = new Map<string, string>();
    // Tracks, per case-folded key, the actually-cased key currently stored
    // in `merged` -- so a same-key-different-casing write from a later
    // source can find and remove the earlier entry instead of coexisting
    // with it.
    const caseFold = new Map<string, string>();

    for (const source of this.sources) {
      const data = source.load();
      for (const [key, value] of Object.entries(data)) {
        const folded = key.toLowerCase();
        const existingKey = caseFold.get(folded);
        if (existingKey !== undefined && existingKey !== key) {
          merged.delete(existingKey);
        }
        merged.set(key, value);
        caseFold.set(folded, key);
      }
    }

    return new ConfigurationRoot(merged);
  }
}
