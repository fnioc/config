// ConfigurationBuilder.
//
// Ships with ONLY add(source) -- matching IConfigurationBuilder exactly, no
// addJsonFile/addEnvironmentVariables/etc. baked in. Each provider package
// (and the in-package Memory provider) bolts its own add* sugar on via TS
// declaration merging + a runtime prototype assignment, mimicking an
// extension method. add() therefore returns `this` (not the widened
// IConfigurationBuilder) so those augmentations type-check without a cast.

import type {
  IConfigurationBuilder,
  IConfigurationProvider,
  IConfigurationRoot,
  IConfigurationSource,
} from "@fnconfig/core";
import { ConfigurationRoot } from "./configuration-root";

export class ConfigurationBuilder implements IConfigurationBuilder {
  readonly #sources = new Set<IConfigurationSource>();

  /** The registered sources, in registration (insertion) order. */
  public get sources(): Set<IConfigurationSource> {
    return this.#sources;
  }

  /** Registers a configuration source. Returns `this` for chaining. */
  public add(source: IConfigurationSource): this {
    this.#sources.add(source);
    return this;
  }

  /**
   * Builds each registered source into a provider (registration order) and
   * constructs a {@link ConfigurationRoot} over them.
   */
  public build(): IConfigurationRoot {
    const providers: IConfigurationProvider[] = [];
    for (const source of this.#sources) {
      providers.push(source.build(this));
    }
    return new ConfigurationRoot(providers);
  }
}
