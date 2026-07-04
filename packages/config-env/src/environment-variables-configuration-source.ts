// EnvironmentVariablesConfigurationSource.
//
// Two pieces of translation happen when a provider built from this source
// loads: a variable-name transformation (default `__` -> `:`, matching most
// shells/platforms being unable to hold a literal colon in an env var name)
// applied to the FULL variable name first, THEN an optional case-insensitive
// prefix match/strip against the transformed name. This order matters: a
// prefix like "Foo:Bar:" only becomes visible on a raw variable such as
// `Foo__Bar__Baz` AFTER the `__` -> `:` transform runs, so the transform must
// happen before prefix-matching, not after (see the provider for where this
// is actually applied). There's no connection-string special-casing here --
// this provider only handles the generic name-transform/prefix-filter path.
//
// The env map itself is a source-level property (`env`, defaulting to
// `process.env`) rather than something the provider reaches for globally.
// That keeps the provider's `load()` a pure function of `this.#source` --
// callers (and tests) can inject an isolated map instead of mutating the real
// process environment.

import type { IConfigurationBuilder, IConfigurationProvider, IConfigurationSource } from "@fnconfig/core";
import { EnvironmentVariablesConfigurationProvider } from "./environment-variables-configuration-provider";

/** Options accepted by {@link EnvironmentVariablesConfigurationSource}. */
export interface EnvironmentVariablesConfigurationSourceOptions {
  /**
   * Only variables whose TRANSFORMED name starts with `prefix` (case-insensitive)
   * are kept; the prefix is stripped from the resulting key.
   */
  prefix?: string;
  /**
   * Transforms a raw environment variable name before prefix matching.
   * Defaults to replacing every `__` with `:`, the conventional way to spell
   * a section-delimited key in an environment variable name.
   */
  variableNameTransformation?: (name: string) => string;
  /**
   * The environment variable map a provider built from this source reads.
   * Defaults to `process.env`; override it to load from an isolated map
   * instead (e.g. in a test) without touching the real process environment.
   */
  env?: Record<string, string | undefined>;
}

/** Default {@link EnvironmentVariablesConfigurationSourceOptions.variableNameTransformation}: `__` -> `:`. */
export function defaultVariableNameTransformation(name: string): string {
  return name.replaceAll("__", ":");
}

/**
 * A configuration source backed by `process.env` (or an injected map),
 * flattened into the colon-delimited key/value store every provider
 * produces, per an optional name prefix and a variable-name transformation.
 */
export class EnvironmentVariablesConfigurationSource implements IConfigurationSource {
  /** Only variables whose transformed name starts with this prefix (case-insensitive) are kept. */
  public prefix?: string;
  /** Applied to each raw variable name before prefix matching. */
  public variableNameTransformation: (name: string) => string;
  /** The environment variable map a provider built from this source reads. Defaults to `process.env`. */
  public env: Record<string, string | undefined>;

  public constructor(options?: EnvironmentVariablesConfigurationSourceOptions) {
    this.prefix = options?.prefix;
    this.variableNameTransformation = options?.variableNameTransformation ?? defaultVariableNameTransformation;
    this.env = options?.env ?? process.env;
  }

  public build(_builder: IConfigurationBuilder): IConfigurationProvider {
    return new EnvironmentVariablesConfigurationProvider(this);
  }
}
