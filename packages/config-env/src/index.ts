// Public entry point for @fnconfig/env.
//
// Bolts `addEnvironmentVariables` sugar onto the shared `ConfigurationBuilder`
// from @fnconfig/config via TS declaration merging + a runtime prototype
// assignment, mimicking an extension method. A consumer who never names a
// runtime symbol from this package (only wants the sugar) needs a bare
// side-effect import: `import "@fnconfig/env";`.

import type { IndexedSection } from "@fnconfig/core";
import { ConfigurationBuilder } from "@fnconfig/config";
import {
  type EnvironmentVariablesConfigurationSourceOptions,
  EnvironmentVariablesConfigurationSource,
} from "./environment-variables-configuration-source";

declare module "@fnconfig/config/configuration-builder" {
  // Generic arity + default MUST match the class (TS2428).
  interface ConfigurationBuilder<T = IndexedSection> {
    /**
     * Registers an {@link EnvironmentVariablesConfigurationSource} seeded from
     * `process.env`, per an optional `options.prefix` and
     * `options.variableNameTransformation`.
     */
    addEnvironmentVariables(options?: EnvironmentVariablesConfigurationSourceOptions): this;
  }
}

ConfigurationBuilder.prototype.addEnvironmentVariables = function (
  this: ConfigurationBuilder,
  options?: EnvironmentVariablesConfigurationSourceOptions,
): ConfigurationBuilder {
  return this.add(new EnvironmentVariablesConfigurationSource(options));
};

export {
  defaultVariableNameTransformation,
  EnvironmentVariablesConfigurationSource,
} from "./environment-variables-configuration-source";
export type { EnvironmentVariablesConfigurationSourceOptions } from "./environment-variables-configuration-source";
export { EnvironmentVariablesConfigurationProvider } from "./environment-variables-configuration-provider";
