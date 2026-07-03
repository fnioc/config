// Public entry point for @fnconfig/json.
//
// Exports JsonConfigurationSource/JsonConfigurationProvider and installs the
// `addJsonFile` sugar onto `@fnconfig/config`'s ConfigurationBuilder via the
// extension-method-mimicking augmentation pattern (TS declaration merging +
// a runtime prototype assignment).
//
// A consumer who never names a runtime symbol from this package (only wants
// the sugar) needs a bare side-effect import: `import "@fnconfig/json";`.
// This package must NOT set `"sideEffects": false` in package.json (would
// let a bundler tree-shake the augmentation away).

import { ConfigurationBuilder } from "@fnconfig/config";
import { JsonConfigurationSource } from "./json-configuration-source";
import type { JsonConfigurationSourceOptions } from "./json-configuration-source";

// Augmenting the declaring module ("@fnconfig/config/configuration-builder"),
// NOT the barrel ("@fnconfig/config") -- TS's declaration merging for a class
// re-exported through another module doesn't merge back onto the class as
// seen through its own declaring module, so augmenting the barrel produces a
// phantom second `ConfigurationBuilder` type the moment another augmentation
// (e.g. core's own addInMemoryCollection) is also in the program. See the
// "configuration-builder-subpath" note in @fnconfig/config's package.json.
declare module "@fnconfig/config/configuration-builder" {
  interface ConfigurationBuilder {
    /** Registers a {@link JsonConfigurationSource} reading `path` (resolved against `process.cwd()`). */
    addJsonFile(path: string, opts?: JsonConfigurationSourceOptions): this;
  }
}

ConfigurationBuilder.prototype.addJsonFile = function (
  this: ConfigurationBuilder,
  path: string,
  opts?: JsonConfigurationSourceOptions,
): ConfigurationBuilder {
  return this.add(new JsonConfigurationSource(path, opts));
};

export { JsonConfigurationProvider } from "./json-configuration-provider";
export { JsonConfigurationSource } from "./json-configuration-source";
export type { JsonConfigurationSourceOptions } from "./json-configuration-source";
