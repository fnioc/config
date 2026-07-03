# @fnconfig/env

Environment-variable configuration provider for `@fnconfig/config` —
`EnvironmentVariablesConfigurationSource`/`EnvironmentVariablesConfigurationProvider`
plus the `addEnvironmentVariables` sugar bolted onto `ConfigurationBuilder`.
Mirrors `Microsoft.Extensions.Configuration.EnvironmentVariables`'s
`AddEnvironmentVariables` extension method.

## Install

```sh
npm install @fnconfig/config @fnconfig/env
```

`@fnconfig/config` is a peer dependency — install it alongside this package.

## Basic usage

```ts
import "@fnconfig/env"; // unlocks .addEnvironmentVariables() on ConfigurationBuilder
import { ConfigurationBuilder } from "@fnconfig/config";

const config = new ConfigurationBuilder()
  .addEnvironmentVariables({ prefix: "APP_" })
  .build();

// APP_SERVER__PORT=8080 in the environment resolves as:
config.get("Server:Port"); // "8080"
```

Variable names are normalized (`__` → `:`) before prefix matching, and the
prefix match itself is case-insensitive — `app_`, `APP_`, and `App_` all match
a `prefix: "APP_"` source.

## The side-effect import requirement

`addEnvironmentVariables` isn't a method `ConfigurationBuilder` ships with —
this package bolts it on via TypeScript declaration merging + a runtime
prototype patch, the same shape as a C# extension method. If your code calls
`.addEnvironmentVariables()` but never names any other symbol from
`@fnconfig/env`, a bundler or tree-shaker has nothing forcing it to load
this package's module — you must import it for its side effect explicitly:

```ts
import "@fnconfig/env"; // unlocks .addEnvironmentVariables() on ConfigurationBuilder
```

This mirrors C#'s `using Microsoft.Extensions.Configuration.EnvironmentVariables;`
— that `using` doesn't reference a type either, it just brings the extension
method into scope.
