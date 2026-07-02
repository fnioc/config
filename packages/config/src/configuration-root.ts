// ConfigurationRoot -- the provider-list engine, ported behaviorally from
// dotnet/runtime's Microsoft.Extensions.Configuration.ConfigurationRoot (plus
// its InternalConfigurationRootExtensions.GetChildrenImplementation).
//
// Providers are stored in registration order and eagerly load()ed at
// construction. Reads resolve LAST-registered-wins by iterating providers in
// REVERSE per lookup (a lazy, per-key resolution -- not an eager merge into a
// flat map). Writes fan out to EVERY provider in forward order.

import type {
  IConfigurationProvider,
  IConfigurationRoot,
  IConfigurationSection,
} from "./abstractions/abstractions";
import { combine } from "./abstractions/configuration-path";
import { ConfigurationSection } from "./configuration-section";

export class ConfigurationRoot implements IConfigurationRoot {
  readonly #providers: IConfigurationProvider[];

  /**
   * Stores `providers` in registration order and eagerly loads each, forward
   * order, so the root reflects every source's data immediately after
   * construction.
   */
  public constructor(providers: Iterable<IConfigurationProvider>) {
    this.#providers = [...providers];
    for (const provider of this.#providers) {
      provider.load();
    }
  }

  /** The providers backing this root, in registration order. */
  public get providers(): Iterable<IConfigurationProvider> {
    return this.#providers;
  }

  /**
   * Reads `key`, checking providers in REVERSE (last-registered first) and
   * returning the first hit -- so the last source to define a key wins,
   * resolved lazily per lookup. Returns `undefined` if no provider has it.
   */
  public get(key: string): string | undefined {
    for (let i = this.#providers.length - 1; i >= 0; i--) {
      const result = (this.#providers[i] as IConfigurationProvider).tryGet(key);
      if (result[0]) {
        return result[1];
      }
    }
    return undefined;
  }

  /**
   * Writes `key` to EVERY provider, forward order. Throws if there are no
   * providers -- there is nowhere to store the value.
   */
  public set(key: string, value: string): this {
    if (this.#providers.length === 0) {
      throw new Error("Cannot set configuration value: no configuration sources are registered.");
    }
    for (const provider of this.#providers) {
      provider.set(key, value);
    }
    return this;
  }

  /** Always returns a section view for `key` -- never null, no existence check. */
  public getSection(key: string): IConfigurationSection {
    return new ConfigurationSection(this, key);
  }

  /** The immediate top-level sections of this root. */
  public getChildren(): Iterable<IConfigurationSection> {
    return this.getChildrenImplementation(undefined);
  }

  /** Forces every provider to reload its source, forward order. */
  public reload(): void {
    for (const provider of this.#providers) {
      provider.load();
    }
  }

  /**
   * Shared child-enumeration for the root and its sections. Folds each
   * provider's `getChildKeys` forward (so the last provider sorts the whole
   * accumulated list), dedups ordinal-ignore-case keeping first occurrence
   * (dedup is the ROOT's job, not the provider's), then maps to sections.
   */
  public getChildrenImplementation(path: string | undefined): IConfigurationSection[] {
    let keys: Iterable<string> = [];
    for (const provider of this.#providers) {
      keys = provider.getChildKeys(keys, path);
    }

    const seen = new Set<string>();
    const distinct: string[] = [];
    for (const key of keys) {
      const folded = key.toLowerCase();
      if (!seen.has(folded)) {
        seen.add(folded);
        distinct.push(key);
      }
    }

    return distinct.map((key) =>
      this.getSection(path === undefined ? key : combine(path, key))
    );
  }
}
