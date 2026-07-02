// Public entry point for @fnioc/config-commandline.
//
// Importing this module installs the `addCommandLine` sugar method onto
// `ConfigurationBuilder` via the extension-method-mimicking augmentation
// pattern (TS declaration merging + a runtime prototype assignment) --
// mirrors C#'s `using Microsoft.Extensions.Configuration.CommandLine;`. A
// consumer who never names a runtime symbol from this package (only wants
// the sugar) needs a bare side-effect import: `import
// "@fnioc/config-commandline";`.
//
// `@fnioc/config` is a peerDependency, kept external in this package's
// bundle (see build.ts/rollup.dts.mjs) -- so the `ConfigurationBuilder` this
// module patches is the SAME class instance the consumer's own
// `@fnioc/config` import resolves to, not a private inlined copy.

import { ConfigurationBuilder } from "@fnioc/config";
import type { CommandLineConfigurationSourceOptions } from "./command-line-configuration-source";
import { CommandLineConfigurationSource } from "./command-line-configuration-source";

// Augmenting the declaring module ("@fnioc/config/configuration-builder"),
// NOT the barrel ("@fnioc/config") -- TS's declaration merging for a class
// re-exported through another module doesn't merge back onto the class as
// seen through its own declaring module, so augmenting the barrel produces a
// phantom second `ConfigurationBuilder` type the moment another augmentation
// (e.g. core's own addInMemoryCollection, or config-json's addJsonFile) is
// also in the program. See the "configuration-builder-subpath" note in
// @fnioc/config's package.json.
declare module "@fnioc/config/configuration-builder" {
  interface ConfigurationBuilder {
    /**
     * Registers a command-line configuration source over `args` (typically
     * `process.argv.slice(2)`), optionally with `switchMappings` for
     * short-switch (`-x`) support. See {@link CommandLineConfigurationSource}
     * for construction-time validation and {@link CommandLineConfigurationProvider}
     * for the parse behavior.
     */
    addCommandLine(
      args: readonly string[],
      switchMappings?: CommandLineConfigurationSourceOptions["switchMappings"],
    ): this;
  }
}

ConfigurationBuilder.prototype.addCommandLine = function (
  this: ConfigurationBuilder,
  args: readonly string[],
  switchMappings?: CommandLineConfigurationSourceOptions["switchMappings"],
): ConfigurationBuilder {
  return this.add(new CommandLineConfigurationSource(args, { switchMappings }));
};

export { CommandLineConfigurationProvider } from "./command-line-configuration-provider";
export {
  CommandLineConfigurationSource,
} from "./command-line-configuration-source";
export type { CommandLineConfigurationSourceOptions } from "./command-line-configuration-source";
