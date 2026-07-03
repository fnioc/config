// ConfigurationSection -- a pure (root, path) view with zero independent
// storage.
//
// Every read/write routes back through the owning ConfigurationRoot with the
// section's path combined onto the requested key, so a section is always a
// live window over the root's providers, never a snapshot.

import type { IConfiguration, IConfigurationSection } from "@fnconfig/core";
import { combine, getSectionKey } from "./abstractions/configuration-path";
import type { ConfigurationRoot } from "./configuration-root";

/**
 * A section of configuration values, identified by its full colon-delimited
 * {@link path} within the owning root. Constructed by
 * {@link ConfigurationRoot.getSection} / {@link IConfiguration.getSection};
 * never instantiated directly by consumers.
 */
export class ConfigurationSection implements IConfigurationSection {
  readonly #root: ConfigurationRoot;
  readonly #path: string;
  #key?: string;

  public constructor(root: ConfigurationRoot, path: string) {
    this.#root = root;
    this.#path = path;
  }

  /** The last segment of this section's path -- its key within its parent. */
  public get key(): string {
    return (this.#key ??= getSectionKey(this.#path) ?? this.#path);
  }

  /** The full colon-delimited path to this section within the root. */
  public get path(): string {
    return this.#path;
  }

  /** The value stored directly at this section's path, if any. */
  public get value(): string | undefined {
    return this.#root.get(this.#path);
  }

  public set value(value: string) {
    this.#root.set(this.#path, value);
  }

  /** Reads a descendant key relative to this section. */
  public get(key: string): string | undefined {
    return this.#root.get(combine(this.#path, key));
  }

  /** Writes a descendant key relative to this section. */
  public set(key: string, value: string): this {
    this.#root.set(combine(this.#path, key), value);
    return this;
  }

  /** A sub-section relative to this section (never null). */
  public getSection(key: string): IConfigurationSection {
    return this.#root.getSection(combine(this.#path, key));
  }

  /** The immediate descendant sections of this section. */
  public getChildren(): Iterable<IConfigurationSection> {
    return this.#root.getChildrenImplementation(this.#path);
  }
}
