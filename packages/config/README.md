# @fnconfig/config

A faithful TypeScript port of `Microsoft.Extensions.Configuration`: layered,
provider-based configuration with last-source-wins precedence, case-insensitive
key resolution, and a compile-time-checked schema binder.

This package is the core — `ConfigurationBuilder`/`ConfigurationRoot`/
`ConfigurationSection`, the abstract `ConfigurationProvider` base, the ported
`IConfiguration*` abstractions, `ConfigurationKeyComparer`, the bundled Memory
provider, and `bindConfig`. It has no file/env/CLI sources of its own beyond
Memory — install `@fnconfig/json`, `@fnconfig/env`, and/or
`@fnconfig/commandline` alongside it for those.

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
here overrides anything `addJsonFile()` loaded for the same key, mirroring
.NET's `IConfiguration` layering model.

## Providers need a side-effect import

Every `add*` method (`addJsonFile`, `addEnvironmentVariables`,
`addCommandLine`) is bolted onto `ConfigurationBuilder` by its own provider
package via TypeScript declaration merging + a runtime prototype patch — the
same shape as a C# extension method. If your code only calls `.addJsonFile()`
and never names another symbol from `@fnconfig/json`, you still need to
import the package for its side effect:

```ts
import "@fnconfig/json"; // unlocks .addJsonFile() on ConfigurationBuilder
```

This mirrors C#'s `using Microsoft.Extensions.Configuration.Json;` — the
`using` doesn't reference a type either, it just brings the extension method
into scope.
