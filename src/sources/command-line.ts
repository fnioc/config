// Command-line ConfigSource -- flattens argv-style tokens (e.g.
// `process.argv.slice(2)`) into the flat colon-delimited key -> string-value
// map every ConfigSource produces. Mirrors .NET's
// CommandLineConfigurationProvider shape: long `--Key value` / `--Key=value`
// switches, and short `-x` switches that must be pre-registered via
// `switchMappings` (an unmapped short switch is a hard error, not silently
// dropped).

import type { ConfigSource } from "./types.js";

/** Options accepted by {@link CommandLineSource}'s constructor. */
export interface CommandLineSourceOptions {
  /**
   * Maps a short switch (including its leading dash, e.g. `"-p"`) to the
   * full delimited key name it should populate (e.g. `"Server:Port"`).
   */
  switchMappings?: Record<string, string>;
}

/**
 * A {@link ConfigSource} that flattens argv-style tokens (typically
 * `process.argv.slice(2)`) into the flat colon-delimited key ->
 * string-value map every source produces -- long `--Key value` /
 * `--Key=value` switches, plus short `-x` switches that must be
 * pre-registered via {@link CommandLineSourceOptions.switchMappings}. See
 * the module doc comment above for the full mirrored-from-.NET behavior.
 */
export class CommandLineSource implements ConfigSource {
  private readonly argv: readonly string[];
  private readonly switchMappings: Record<string, string>;

  public constructor(
    argv: readonly string[],
    opts?: CommandLineSourceOptions,
  ) {
    this.argv = argv;
    this.switchMappings = opts?.switchMappings ?? {};
  }

  public load(): Record<string, string> {
    const result: Record<string, string> = {};
    const argv = this.argv;

    for (let i = 0; i < argv.length; i++) {
      const token = argv[i];
      if (token === undefined) {
        continue;
      }

      if (token.startsWith("--")) {
        i = this.consumeLongSwitch(token, argv, i, result);
        continue;
      }

      if (token.startsWith("-")) {
        i = this.consumeShortSwitch(token, argv, i, result);
        continue;
      }

      // Bare positional arg (no leading dash) -- ignored.
    }

    return result;
  }

  /** Handles a `--Key value` / `--Key=value` token; returns the new index. */
  private consumeLongSwitch(
    token: string,
    argv: readonly string[],
    index: number,
    result: Record<string, string>,
  ): number {
    const rest = token.slice(2);
    const eqIndex = rest.indexOf("=");

    if (eqIndex !== -1) {
      const key = rest.slice(0, eqIndex);
      result[key] = rest.slice(eqIndex + 1);
      return index;
    }

    const value = argv[index + 1];
    if (value === undefined) {
      throw new Error(
        `Missing value for command-line switch "${token}" -- expected "${token} <value>" or "${token}=<value>"`,
      );
    }

    result[rest] = value;
    return index + 1;
  }

  /** Handles a mapped `-x value` / `-x=value` token; returns the new index. */
  private consumeShortSwitch(
    token: string,
    argv: readonly string[],
    index: number,
    result: Record<string, string>,
  ): number {
    const eqIndex = token.indexOf("=");
    const switchName = eqIndex !== -1 ? token.slice(0, eqIndex) : token;
    const mappedKey = this.switchMappings[switchName];

    if (mappedKey === undefined) {
      throw new Error(
        `Unmapped command-line switch "${switchName}" -- register it in switchMappings before it can be used`,
      );
    }

    if (eqIndex !== -1) {
      result[mappedKey] = token.slice(eqIndex + 1);
      return index;
    }

    const value = argv[index + 1];
    if (value === undefined) {
      throw new Error(
        `Missing value for command-line switch "${switchName}" -- expected "${switchName} <value>" or "${switchName}=<value>"`,
      );
    }

    result[mappedKey] = value;
    return index + 1;
  }
}
