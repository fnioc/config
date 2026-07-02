// Shared test helper. `rootOf` replaces the pre-rewrite
// `new ConfigurationRoot(new Map(...))` construction pattern: it builds a real
// provider-list-backed root over a single Memory provider, exercising the
// production ConfigurationBuilder -> MemoryConfigurationSource ->
// ConfigurationRoot path rather than hand-constructing an internal map.

import { type ConfigurationData, ConfigurationBuilder } from "@fnioc/config";
import type { IConfigurationRoot } from "@fnioc/config";

/** Builds a ConfigurationRoot from in-memory `entries` (a Record or `[k,v]` iterable). */
export function rootOf(entries: ConfigurationData): IConfigurationRoot {
  return new ConfigurationBuilder().addInMemoryCollection(entries).build();
}
