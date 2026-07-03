# @fnconfig/config

Layered, provider-based configuration for TypeScript: build a configuration
tree out of multiple sources, resolve keys with last-source-wins precedence
and case-insensitive matching, and bind the result to a typed schema at
compile time.

This package is the engine — `ConfigurationBuilder`/`ConfigurationRoot`/
`ConfigurationSection`, the abstract `ConfigurationProvider` base, the
`IConfiguration*` abstractions (re-exported from `@fnconfig/core`),
`ConfigurationKeyComparer`, the bundled Memory provider, and `bindConfig`. It
has no file/env/CLI sources of its own beyond Memory — install
`@fnconfig/json`, `@fnconfig/env`, and/or `@fnconfig/commandline` alongside
it for those.

## Install

```sh
npm install @fnconfig/config
```

## Basic usage

```ts
import { ConfigurationBuilder } from "@fnconfig/config";

const config = new ConfigurationBuilder()
  .addInMemoryCollection({ "Server:Port": "8080" })
  .build();

config.get("Server:Port"); // "8080"
config.getSection("Server").get("Port"); // "8080"
```

More idiomatically, install a provider package and use its `add*` sugar
instead of constructing sources by hand:

```ts
import "@fnconfig/json";
import "@fnconfig/env";
import { ConfigurationBuilder, bindConfig } from "@fnconfig/config";

interface AppConfig {
  Server: { Port: number; Host: string };
}

const config = new ConfigurationBuilder()
  .addJsonFile("appsettings.json")
  .addEnvironmentVariables({ prefix: "APP_" })
  .build();

const app = bindConfig<AppConfig>(config);
```

Sources are checked **last-registered first**: `addEnvironmentVariables()`
here overrides anything `addJsonFile()` loaded for the same key.

## Providers need a side-effect import

Every `add*` method (`addJsonFile`, `addEnvironmentVariables`,
`addCommandLine`) is bolted onto `ConfigurationBuilder` by its own provider
package via TypeScript declaration merging plus a runtime prototype patch.
If your code only calls `.addJsonFile()` and never names another symbol from
`@fnconfig/json`, you still need to import the package for its side effect:

```ts
import "@fnconfig/json"; // unlocks .addJsonFile() on ConfigurationBuilder
```

A bundler or tree-shaker has nothing else forcing that module to load, since
no value is actually referenced — the import exists purely to run the
augmentation.
