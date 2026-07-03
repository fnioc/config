// Public entry point for @fnconfig/env.
//
// Bolts `addEnvironmentVariables` sugar onto the shared `ConfigurationBuilder`
// from @fnconfig/config via TS declaration merging + a runtime prototype
// assignment, mimicking a C# extension method (see
// Microsoft.Extensions.Configuration.EnvironmentVariables' own
// `EnvironmentVariablesExtensions.AddEnvironmentVariables`). A consumer who
// never names a runtime symbol from this package (only wants the sugar) needs
// a bare side-effect import: `import "@fnconfig/env";`.

import { ConfigurationBuilder } from "@fnconfig/config";
import {
  type EnvironmentVariablesConfigurationSourceOptions,
  EnvironmentVariablesConfigurationSource,
} from "./environment-variables-configuration-source";

declare module "@fnconfig/config/configuration-builder" {
  interface ConfigurationBuilder {
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
